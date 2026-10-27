import { create } from 'zustand';
import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createThrottledLocalStorage, flushThrottledStorage } from '@shared/lib/throttledStorage';
import type { WorkoutWithSets } from '@shared/lib/types';
import { devError } from '@shared/lib/devtools';
import { saveWorkoutOrQueue } from '@shared/lib/saveWorkout';
import { useOutboxStore } from '@shared/stores/outboxStore';
import { reconcileReminders } from '@shared/lib/reminderReconcile';
import { notifyNewRecords } from '@shared/lib/prNotification';
import { getRoutineReminderDays } from '@features/routine/lib/routineReminders';
import { queryClient } from '@app/queryClient';
import { toLocalDateKey } from '@shared/lib/dateKeys';
import {
  parseDurationSeconds,
  parseReps,
  selectSetsForSave,
} from '@features/workout/lib/setValidation';

/**
 * Forma de una fila del formulario. **No valida**: los límites de longitud de
 * antes (`reps.max(4)`, `weight.max(6)`) descartaban la fila entera antes de
 * llegar a ninguna comprobación, así que un peso en libras con decimales o un
 * dato heredado largo se perdía sin decir nada. Qué se puede guardar lo decide
 * `selectSetsForSave`.
 */
interface SetData {
  id: string;
  // Vacío en una serie por tiempo; la regla «tiene que medir algo» es conjunta
  // y vive en `setValidation`.
  reps: string;
  // Sin mínimo: una serie sin lastre pesa 0 y es válida.
  weight: string;
  /** Segundos aguantados, como texto. Vacío en una serie de repeticiones. */
  durationSeconds: string;
  isWarmup: boolean;
  notes: string;
  // RPE 1-10 como string ('' = sin valor). Validado a SMALLINT en la RPC.
  rpe: string;
  // Tipo de serie avanzado. 'normal' por defecto.
  setType: 'normal' | 'dropset' | 'rest_pause' | 'amrap';
  // Marcar con ✓. Solo importa durante la sesión: al guardar decide qué series
  // se incluyen si el usuario elige «solo completadas». No se persiste en BD.
  completed: boolean;
  /**
   * La fila la creó la app al cerrar la serie anterior, no la escribió nadie.
   *
   * Nace heredando peso y reps, así que con «guardar todas» se colaba en el
   * entreno una serie que el usuario nunca hizo. Se apaga en cuanto se toca
   * cualquier campo, que es la señal de que ya es suya. No se persiste en BD.
   */
  autofilled: boolean;
}

interface PersistedWorkout {
  activeExerciseId: string | null;
  customExerciseName: string;
  customMuscleGroup: string;
  sets: SetData[];
  startedAt: string | null;
  sessionNotes: string;
  sessionRating: number | null;
  /**
   * Clave de idempotencia del guardado en curso.
   *
   * Se genera en el primer intento y **se conserva si ese intento falla**: al
   * reintentar tiene que viajar la misma, o el servidor no puede reconocer que
   * ya escribió ese entreno. Antes se generaba dentro de `saveWorkout`, así que
   * cada reintento traía una nueva y un fallo de red con la respuesta perdida
   * acababa en dos entrenos idénticos en el historial.
   */
  clientId: string | null;
  /**
   * Hora de cierre del guardado en curso.
   *
   * Se fija en el primer intento y **se conserva si ese intento falla**: forma
   * parte de la huella que el servidor guarda junto a `client_id`. Si cambiara
   * en cada reintento, el mismo envío parecería otro contenido y el servidor lo
   * rechazaría con `idempotency_conflict` para siempre. Es lo que dejaba una
   * rutina a medias sin poder terminarse nunca.
   */
  finishedAt: string | null;
  /**
   * Huella del contenido que acompañó a `clientId`.
   *
   * Permite distinguir «reintento del mismo envío» (misma clave) de «el usuario
   * corrigió el entreno después de un fallo» (clave nueva). Reutilizar la clave
   * con otro contenido es justo lo que el servidor rechaza.
   */
  saveFingerprint: string | null;
}

interface SaveWorkoutResult {
  error: Error | null;
  success: boolean;
  queued?: boolean;
  /** Filas que impidieron el guardado, por índice. La pantalla las abre. */
  setErrors?: Record<number, string>;
}

interface WorkoutState extends PersistedWorkout {
  loading: boolean;
  error: string | null;
  customMuscleGroup: string;
  /** El ejercicio activo es de peso corporal: el kg introducido es lastre. */
  bodyweightMode: boolean;
  /** Peso corporal vigente para estimar el volumen en modo peso corporal. */
  bodyWeightKg: number | null;
  setBodyweightContext: (mode: boolean, bodyWeightKg: number | null) => void;
  repeatWorkout: (workout: WorkoutWithSets) => void;
  setActiveExercise: (id: string | null) => void;
  setCustomExerciseName: (name: string) => void;
  setSessionNotes: (notes: string) => void;
  setSessionRating: (rating: number | null) => void;
  addSet: () => void;
  setSets: (sets: SetData[]) => void;
  updateSet: (index: number, data: Partial<SetData>) => void;
  removeSet: (index: number) => void;
  removeAllSets: () => void;
  saveWorkout: (
    userId: string,
    opts?: {
      onlyCompleted?: boolean;
      /**
       * Contexto de peso corporal **explícito**.
       *
       * La pantalla lo calcula del ejercicio activo y lo pasa aquí. Antes solo
       * se leía del store, que se actualiza en un efecto: al cambiar de
       * ejercicio y guardar de inmediato podía seguir el valor del anterior, y
       * el peso se guardaba como lastre (o como total) según el ejercicio
       * equivocado.
       */
      bodyweight?: boolean;
      bodyWeightKg?: number | null;
    },
  ) => Promise<SaveWorkoutResult>;
  clearPersistedState: () => void;
}

const makeSet = (
  reps = '',
  weight = '',
  isWarmup = false,
  notes = '',
  rpe = '',
  durationSeconds = '',
): SetData => ({
  id: crypto.randomUUID(),
  reps,
  weight,
  durationSeconds,
  isWarmup,
  notes,
  rpe,
  setType: 'normal',
  completed: false,
  autofilled: false,
});

/** Campos cuya edición convierte una fila heredada en una fila del usuario. */
const TOUCH_FIELDS = [
  'reps',
  'weight',
  'durationSeconds',
  'rpe',
  'notes',
  'isWarmup',
  'setType',
] as const satisfies readonly (keyof SetData)[];

/** Segundos válidos de la serie, o `null` si no se mide en tiempo. */
export function segundosDeSerie(s: { durationSeconds?: string }): number | null {
  return parseDurationSeconds(s.durationSeconds);
}

/**
 * Repeticiones válidas de la serie, o `null` si no se mide en repeticiones.
 * Delegado en la validación compartida para que no vuelvan a divergir.
 */
export function repsDeSerie(s: { reps?: string }): number | null {
  return parseReps(s.reps);
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      activeExerciseId: null,
      customExerciseName: '',
      customMuscleGroup: DEFAULT_MUSCLE_GROUP,
      sets: [],
      startedAt: null,
      sessionNotes: '',
      sessionRating: null,
      clientId: null,
      finishedAt: null,
      saveFingerprint: null,
      loading: false,
      error: null,
      bodyweightMode: false,
      bodyWeightKg: null,
      setBodyweightContext: (mode, bodyWeightKg) => set({ bodyweightMode: mode, bodyWeightKg }),
      repeatWorkout: (workout: WorkoutWithSets) => {
        if (workout.sets.length === 0) return;
        const exerciseId = workout.sets[0].exercise_id;
        const sortedSets = [...workout.sets].sort((a, b) => a.set_num - b.set_num);
        set({
          activeExerciseId: exerciseId,
          customExerciseName: '',
          // Entreno nuevo: la clave de idempotencia del anterior no vale aquí.
          clientId: null,
          finishedAt: null,
          saveFingerprint: null,
          sets: sortedSets.map((s) => {
            const rpeVal = (s as { rpe?: number | null }).rpe;
            return makeSet(
              String(s.reps),
              String(s.weight),
              !!(s as { is_warmup?: boolean | null }).is_warmup,
              (s as { notes?: string | null }).notes ?? '',
              rpeVal != null ? String(rpeVal) : '',
            );
          }),
          startedAt: new Date().toISOString(),
        });
      },

      setActiveExercise: (id: string | null) => {
        const currentStartedAt = get().startedAt;
        set({
          activeExerciseId: id,
          startedAt: id && !currentStartedAt ? new Date().toISOString() : currentStartedAt,
        });
      },
      setCustomExerciseName: (name: string) => set({ customExerciseName: name }),
      setSessionNotes: (notes: string) => set({ sessionNotes: notes }),
      setSessionRating: (rating: number | null) => set({ sessionRating: rating }),

      addSet: () => {
        const last = get().sets.at(-1);
        // Heredada = puesta por la app. Si alguien la toca deja de serlo, y si
        // no, no se guarda: ver `autofilled` en el schema.
        set({
          sets: [
            ...get().sets,
            last ? { ...makeSet(last.reps, last.weight), autofilled: true } : makeSet(),
          ],
        });
      },

      setSets: (newSets: SetData[]) => set({ sets: newSets }),

      updateSet: (index: number, data: Partial<SetData>) => {
        const newSets = [...get().sets];
        // Cualquier edición hace suya la fila heredada. `completed` no cuenta:
        // marcar el ✓ no es escribir un dato.
        const tocada = TOUCH_FIELDS.some((k) => k in data);
        newSets[index] = { ...newSets[index], ...data, ...(tocada ? { autofilled: false } : {}) };
        set({ sets: newSets });
      },

      removeSet: (index: number) => {
        set({ sets: get().sets.filter((_, i) => i !== index) });
      },

      removeAllSets: () => {
        set({ sets: [] });
      },

      saveWorkout: async (
        userId: string,
        opts?: { onlyCompleted?: boolean; bodyweight?: boolean; bodyWeightKg?: number | null },
      ) => {
        const {
          activeExerciseId,
          customExerciseName,
          customMuscleGroup,
          sets: setData,
          sessionNotes,
          sessionRating,
          startedAt: storedStartedAt,
          bodyweightMode,
          bodyWeightKg,
        } = get();

        // Los errores viajan como clave de i18n, no como frase: el store no
        // tiene `t` y la pantalla sí. Antes salían en español con la app en
        // inglés.
        if (!activeExerciseId && !customExerciseName.trim()) {
          return { error: new Error('workout.errors.pick_exercise'), success: false };
        }

        // Una sola regla para pantalla y store. Antes cada uno filtraba a su
        // manera: la pantalla aceptaba reps sin peso y el store las tiraba, de
        // modo que «Guardar» respondía «no hay series válidas» sobre la serie
        // que el usuario acababa de escribir.
        const { selected, errors } = selectSetsForSave(setData, {
          onlyCompleted: opts?.onlyCompleted,
        });
        const failedRows = Object.keys(errors).map(Number);
        if (failedRows.length > 0) {
          devError('[WorkoutStore] series sin guardar', {
            exerciseId: activeExerciseId,
            rows: failedRows,
            codes: failedRows.map((i) => errors[i]),
          });
          return {
            error: new Error(errors[failedRows[0]]),
            success: false,
            setErrors: errors,
          };
        }
        if (!selected.length) {
          return { error: new Error('workout.errors.no_valid_sets'), success: false };
        }

        // El contexto explícito manda: el del store se actualiza en un efecto y
        // puede ir un ejercicio por detrás al guardar justo después de cambiar.
        const bodyweight = opts?.bodyweight ?? bodyweightMode;
        const effectiveBodyWeight =
          opts?.bodyWeightKg !== undefined ? opts.bodyWeightKg : bodyWeightKg;

        const startedAt = storedStartedAt || new Date().toISOString();
        const notes = sessionNotes.trim() || undefined;
        const rating = sessionRating ?? undefined;

        // En modo peso corporal el kg introducido es lastre; el peso guardado es
        // (peso corporal vigente + lastre) para que volumen/PRs sean correctos.
        const setsPayload = selected.map((s, i) => {
          const source = setData[s.index];
          return {
            set_num: i + 1,
            // `null`, no `0`: es lo que separa «no se mide así» de «hizo cero».
            reps: s.reps,
            weight: bodyweight ? (effectiveBodyWeight ?? 0) + s.weightKg : s.weightKg,
            is_warmup: !!source.isWarmup,
            notes: source.notes?.trim() || '',
            rpe: source.rpe?.trim() || '',
            set_type: source.setType || 'normal',
            // Solo viaja si de verdad hay duración: la RPC ignora lo que no
            // parezca un entero positivo, pero mandar `undefined` es más claro
            // que mandar un campo vacío en cada serie de repeticiones.
            ...(s.durationSeconds != null ? { duration_seconds: s.durationSeconds } : {}),
          };
        });

        // Huella del contenido, en el mismo espíritu que la del servidor: si el
        // usuario corrige el entreno después de un fallo duro, la clave vieja
        // ya no representa este envío y reutilizarla acabaría en
        // `idempotency_conflict`. Si el contenido no cambia, la clave se
        // conserva y el reintento es reconocido como el mismo guardado.
        const fingerprint = JSON.stringify([
          activeExerciseId,
          customExerciseName.trim(),
          startedAt,
          setsPayload,
          notes ?? '',
          rating ?? null,
        ]);

        const previous = get();
        let clientId = previous.clientId;
        let finishedAt = previous.finishedAt;
        let saveFingerprint = previous.saveFingerprint;
        const contentChanged =
          clientId != null && saveFingerprint != null && saveFingerprint !== fingerprint;

        if (!clientId) {
          clientId = crypto.randomUUID();
          finishedAt = new Date().toISOString();
          saveFingerprint = fingerprint;
        } else if (contentChanged) {
          // Fallo duro con el contenido ya corregido: envío nuevo. El anterior
          // no llegó a escribirse (la RPC es atómica), así que no duplica nada.
          clientId = crypto.randomUUID();
          finishedAt = new Date().toISOString();
          saveFingerprint = fingerprint;
          devError('[WorkoutStore] contenido cambiado tras un fallo: nueva clave', {
            exerciseId: activeExerciseId,
            clientId,
          });
        } else {
          // Sesión de una versión anterior: no hay huella con la que comparar.
          // Se adopta la actual sin rotar, igual que hace el servidor al
          // reencontrar una fila sin `idempotency_hash`.
          saveFingerprint ??= fingerprint;
          finishedAt ??= new Date().toISOString();
        }

        // La identidad se guarda (y se vuelca) **antes** de la red: si el
        // intento falla o la app muere a mitad, el reintento manda la misma.
        if (
          previous.clientId !== clientId ||
          previous.finishedAt !== finishedAt ||
          previous.startedAt !== startedAt ||
          previous.saveFingerprint !== saveFingerprint
        ) {
          set({ clientId, finishedAt, startedAt, saveFingerprint });
          flushThrottledStorage();
        }

        const resetState = () =>
          set({
            sets: [],
            activeExerciseId: null,
            customExerciseName: '',
            customMuscleGroup: DEFAULT_MUSCLE_GROUP,
            startedAt: null,
            sessionNotes: '',
            sessionRating: null,
            // Guardado (o encolado): la próxima sesión estrena clave.
            clientId: null,
            finishedAt: null,
            saveFingerprint: null,
          });

        // Ya ha entrenado hoy: silencia los recordatorios de hoy al instante.
        // La caché de `trainedToday` se actualiza en el mismo sitio para que el
        // aviso de apertura y la reconciliación no discrepen entre sí.
        const onSaved = () => {
          resetState();
          queryClient.setQueryData(['trainedToday', userId, toLocalDateKey(new Date())], true);
          void reconcileReminders(userId, getRoutineReminderDays(), { trainedToday: true });
        };

        const outcome = await saveWorkoutOrQueue({
          clientId,
          userId,
          exerciseId: activeExerciseId,
          customExerciseName,
          customMuscleGroup,
          startedAt,
          finishedAt,
          sets: setsPayload,
          notes,
          rating,
        });

        if (outcome.status === 'error') {
          devError('[WorkoutStore] saveWorkout falló', {
            clientId,
            exerciseId: activeExerciseId,
            phase: 'rpc',
            code: (outcome.error as { code?: string }).code ?? null,
            message: outcome.error.message,
          });
          return {
            error: new Error(outcome.error.message, { cause: outcome.error }),
            success: false,
          };
        }

        onSaved();
        if (outcome.status === 'queued') {
          void useOutboxStore.getState().refresh();
          return { error: null, success: true, queued: true };
        }

        // Récords: solo cuando el entreno ha llegado al servidor. Los calcula un
        // trigger allí, así que con el entreno en la cola de salida todavía no
        // existe ninguno. No se espera: la enhorabuena no debe retrasar el
        // cierre de la pantalla.
        void notifyNewRecords(userId, startedAt);

        return { error: null, success: true };
      },

      clearPersistedState: () =>
        set({
          activeExerciseId: null,
          customExerciseName: '',
          customMuscleGroup: DEFAULT_MUSCLE_GROUP,
          sets: [],
          startedAt: null,
          sessionNotes: '',
          sessionRating: null,
          clientId: null,
          finishedAt: null,
          saveFingerprint: null,
        }),
    }),
    {
      name: 'gymlog-workout',
      // Agrupado: `updateSet` corre por cada tecla en reps/kg y sin esto cada
      // carácter serializaba y escribía el estado entero en el hilo principal.
      storage: createJSONStorage(() => createThrottledLocalStorage()),
      partialize: (state) => ({
        activeExerciseId: state.activeExerciseId,
        customExerciseName: state.customExerciseName,
        customMuscleGroup: state.customMuscleGroup,
        sets: state.sets,
        startedAt: state.startedAt,
        sessionNotes: state.sessionNotes,
        sessionRating: state.sessionRating,
        clientId: state.clientId,
        // Sin esto, un fallo de red perdía la hora de cierre y el reintento
        // mandaba otra distinta: mismo `client_id`, huella distinta, conflicto.
        finishedAt: state.finishedAt,
        saveFingerprint: state.saveFingerprint,
      }),
    },
  ),
);
