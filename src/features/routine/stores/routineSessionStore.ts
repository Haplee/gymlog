import { create } from 'zustand';
import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devError } from '@shared/lib/devtools';
import { enqueueWorkout, type OutboxSet } from '@shared/lib/workoutOutbox';
import { saveWorkoutOrQueue } from '@shared/lib/saveWorkout';
import { useOutboxStore } from '@shared/stores/outboxStore';
import { normalizeExerciseName } from '@shared/lib/progressionCycle';
import type { DayOfWeek, DayRoutine, Routine } from './routineStore';
import { planDurationOf, planModeOf } from '../utils/planTarget';

export interface SessionSet {
  id: string;
  reps: string;
  weight: string;
  /** Segundos aguantados. Vacío en una serie de repeticiones. */
  durationSeconds: string;
}

export interface SessionExercise {
  /** Nombre tal cual figura en la rutina; se resuelve a exercise_id al guardar. */
  name: string;
  /** Objetivo de la plantilla, solo informativo en la UI. */
  targetSets?: number;
  targetReps?: string;
  /**
   * Cómo se registra, copiado del plan al empezar la sesión.
   *
   * Se copia en vez de leerse de la rutina en cada render porque la sesión debe
   * sobrevivir a que el usuario edite la rutina a mitad: lo que se está
   * registrando es el plan de cuando se pulsó «empezar», no el de ahora.
   */
  mode?: 'reps' | 'time';
  perSide?: boolean;
  /** Segundos objetivo por serie cuando `mode === 'time'`. */
  targetDurationSeconds?: number;
  sets: SessionSet[];
}

export interface RoutineSessionResult {
  error: Error | null;
  success: boolean;
  queued?: boolean;
  /** Nº de ejercicios con al menos una serie válida que se han registrado. */
  savedExercises: number;
}

interface RoutineSessionState {
  routineId: string | null;
  routineName: string;
  dayName: string;
  day: DayOfWeek | null;
  startedAt: string | null;
  exercises: SessionExercise[];
  saving: boolean;

  isActive: () => boolean;
  /**
   * @param prefills Pesos a precargar por nombre normalizado de ejercicio
   *   (auto-relleno). Las filas quedan con ese peso ya escrito, listas para
   *   ajustar o registrar directamente.
   */
  start: (
    routine: Routine,
    day: DayOfWeek,
    dayRoutine: DayRoutine,
    prefills?: Record<string, string>,
  ) => void;
  addSet: (exerciseIndex: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, data: Partial<SessionSet>) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  /**
   * Reemplaza la lista de ejercicios. La usa la sesión de rutina en su modo
   * de autocompletado para rellenar el peso recomendado en cada serie antes
   * de `finish`, sin que el usuario tenga que teclear nada.
   */
  setExercises: (exercises: SessionExercise[]) => void;
  discard: () => void;
  /**
   * Guarda la sesión completa. `resolveExerciseId` mapea el nombre de la rutina
   * al id del catálogo (propio o público); si devuelve null se crea como custom.
   * `toKg` convierte el peso tecleado (unidad de display) a kg, que es como lo
   * almacena la BD.
   */
  finish: (
    userId: string,
    resolveExerciseId: (name: string) => string | null,
    toKg: (weight: number) => number,
  ) => Promise<RoutineSessionResult>;
}

const makeSet = (reps = '', weight = '', durationSeconds = ''): SessionSet => ({
  id: crypto.randomUUID(),
  reps,
  weight,
  durationSeconds,
});

/**
 * Repeticiones objetivo de la plantilla como valor inicial de la fila.
 *
 * La rutina ya dice cuántas repeticiones toca, así que empezar con las filas
 * en blanco obligaba a teclear lo mismo una vez por serie: en un 4×5 son cuatro
 * cincos a mano antes de poder registrar nada.
 *
 * Se coge el primer número del texto porque el campo es libre y admite desde
 * «5» hasta «8-10», «10 por pierna» o «30-45s». En un rango se propone el
 * extremo bajo: es el valor que el usuario baja o sube, pero nunca uno que no
 * haya hecho. Si no hay número (por ejemplo «al fallo») se deja vacío.
 */
function targetRepsValue(reps?: string): string {
  const match = reps?.trim().match(/^\d+/);
  return match ? match[0] : '';
}

/** Segundos válidos de la serie, o `null` si no se mide en tiempo. */
function segundosDe(s: SessionSet): number | null {
  const n = Number.parseInt(s.durationSeconds ?? '', 10);
  return Number.isFinite(n) && n > 0 && n <= 3600 ? n : null;
}

/** Repeticiones válidas de la serie, o `null` si no se miden. */
function repsDe(s: SessionSet): number | null {
  const n = Number(s.reps);
  return s.reps.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Una serie cuenta si mide algo —repeticiones o segundos— y el peso es válido.
 *
 * Una plancha **sin lastre pesa 0 y vale**: exigirle un peso positivo dejaría
 * fuera justo el caso normal. En cambio una serie de repeticiones sin peso sigue
 * sin contar, que es como funcionaba antes.
 */
function isValidSet(s: SessionSet): boolean {
  const segundos = segundosDe(s);
  const reps = repsDe(s);
  if (reps == null && segundos == null) return false;

  const weight = Number(s.weight);
  if (segundos != null && reps == null) {
    // Sin peso escrito se entiende «sin lastre», no «serie inválida».
    return !s.weight.trim() || (Number.isFinite(weight) && weight >= 0);
  }
  if (!s.weight.trim() || !Number.isFinite(weight) || weight < 0) return false;
  return true;
}

function toOutboxSets(sets: SessionSet[], toKg: (w: number) => number): OutboxSet[] {
  return sets.filter(isValidSet).map((s, i) => {
    const segundos = segundosDe(s);
    const peso = s.weight.trim() ? toKg(Number(s.weight)) : 0;
    return {
      set_num: i + 1,
      // `null`, no `0`: la BD distingue «no se mide así» de «hizo cero».
      reps: repsDe(s),
      weight: peso,
      is_warmup: false,
      notes: '',
      rpe: '',
      set_type: 'normal',
      ...(segundos != null ? { duration_seconds: segundos } : {}),
    };
  });
}

const emptySession = {
  routineId: null,
  routineName: '',
  dayName: '',
  day: null,
  startedAt: null,
  exercises: [] as SessionExercise[],
  saving: false,
};

export const useRoutineSessionStore = create<RoutineSessionState>()(
  persist(
    (set, get) => ({
      ...emptySession,

      isActive: () => get().startedAt !== null && get().exercises.length > 0,

      start: (routine, day, dayRoutine, prefills) => {
        set({
          routineId: routine.id,
          routineName: routine.name,
          dayName: dayRoutine.name,
          day,
          startedAt: new Date().toISOString(),
          saving: false,
          exercises: dayRoutine.exercises.map((ex) => {
            const modo = planModeOf(ex);
            const duracion = planDurationOf(ex);
            return {
              name: ex.name,
              targetSets: ex.sets,
              targetReps: ex.reps,
              ...(modo === 'time' ? { mode: 'time' as const } : {}),
              ...(ex.perSide ? { perSide: true } : {}),
              ...(duracion != null ? { targetDurationSeconds: duracion } : {}),
              // Una fila por serie objetivo, ya con el objetivo puesto: así
              // registrar la rutina tal cual sale es solo escribir los pesos. Si
              // hay auto-relleno, el peso de la última sesión ya viene escrito.
              // En modo tiempo lo que se precarga son los segundos del plan, no
              // las repeticiones: `targetReps` puede traer un «30-45s» viejo
              // escrito a mano y tomarlo por repeticiones sería inventarse 30.
              sets: Array.from({ length: Math.max(1, ex.sets ?? 1) }, () =>
                makeSet(
                  modo === 'time' ? '' : targetRepsValue(ex.reps),
                  prefills?.[normalizeExerciseName(ex.name)] ?? '',
                  duracion != null ? String(duracion) : '',
                ),
              ),
            };
          }),
        });
      },

      addSet: (exerciseIndex) => {
        const exercises = get().exercises.map((ex, i) => {
          if (i !== exerciseIndex) return ex;
          const last = ex.sets.at(-1);
          return {
            ...ex,
            sets: [
              ...ex.sets,
              makeSet(last?.reps ?? '', last?.weight ?? '', last?.durationSeconds ?? ''),
            ],
          };
        });
        set({ exercises });
      },

      updateSet: (exerciseIndex, setIndex, data) => {
        const exercises = get().exercises.map((ex, i) => {
          if (i !== exerciseIndex) return ex;
          return {
            ...ex,
            sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, ...data } : s)),
          };
        });
        set({ exercises });
      },

      removeSet: (exerciseIndex, setIndex) => {
        const exercises = get().exercises.map((ex, i) => {
          if (i !== exerciseIndex) return ex;
          return { ...ex, sets: ex.sets.filter((_, j) => j !== setIndex) };
        });
        set({ exercises });
      },

      setExercises: (exercises) => set({ exercises }),

      discard: () => set({ ...emptySession }),

      finish: async (userId, resolveExerciseId, toKg) => {
        const { exercises, startedAt, saving } = get();
        if (saving) {
          return { error: null, success: false, savedExercises: 0 };
        }

        // Solo se registran los ejercicios que el usuario realmente ha hecho.
        // `clientId` es la clave de idempotencia de cada ejercicio: se genera una
        // sola vez y viaja igual en el intento directo y en el outbox, para que un
        // reenvío tras perder la respuesta no vuelva a escribir el mismo entreno.
        const done = exercises
          .map((ex) => ({
            name: ex.name,
            sets: toOutboxSets(ex.sets, toKg),
            clientId: crypto.randomUUID(),
          }))
          .filter((ex) => ex.sets.length > 0);

        if (!done.length) {
          return {
            error: new Error('Registra al menos una serie con reps y kg'),
            success: false,
            savedExercises: 0,
          };
        }

        const started = startedAt ?? new Date().toISOString();
        const finished = new Date().toISOString();

        set({ saving: true });

        const notes =
          [get().routineName, get().dayName].filter(Boolean).join(' — ').trim() || undefined;

        // El esquema guarda un `workout` por ejercicio: la sesión de rutina se
        // escribe como N entrenos que comparten started_at/finished_at, de modo
        // que el historial (que agrupa por día) los muestre como una sesión.
        const enqueueRest = async (pending: typeof done) => {
          for (const ex of pending) {
            await enqueueWorkout({
              id: ex.clientId,
              userId,
              exerciseId: resolveExerciseId(ex.name),
              customExerciseName: ex.name,
              customMuscleGroup: DEFAULT_MUSCLE_GROUP,
              startedAt: started,
              finishedAt: finished,
              sets: ex.sets,
              notes,
              createdAt: new Date().toISOString(),
            });
          }
        };

        const finishQueued = async (savedExercises: number) => {
          set({ ...emptySession });
          void useOutboxStore.getState().refresh();
          return { error: null, success: true, queued: true, savedExercises };
        };

        let saved = 0;
        for (const [i, ex] of done.entries()) {
          const outcome = await saveWorkoutOrQueue({
            clientId: ex.clientId,
            userId,
            exerciseId: resolveExerciseId(ex.name),
            customExerciseName: ex.name,
            customMuscleGroup: DEFAULT_MUSCLE_GROUP,
            startedAt: started,
            finishedAt: finished,
            sets: ex.sets,
            notes,
          });

          if (outcome.status === 'error') {
            set({ saving: false });
            devError('[RoutineSession] finish:', outcome.error.message);
            return { error: outcome.error, success: false, savedExercises: saved };
          }

          if (outcome.status === 'queued') {
            // Este ya está en la cola; faltan los que ni se han intentado. El
            // corte va en `i + 1` justamente por eso: encolar desde `i` lo
            // metería dos veces.
            await enqueueRest(done.slice(i + 1));
            return finishQueued(done.length);
          }

          saved += 1;
        }

        set({ ...emptySession });
        return { error: null, success: true, savedExercises: saved };
      },
    }),
    {
      name: 'gymlog-routine-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        routineId: s.routineId,
        routineName: s.routineName,
        dayName: s.dayName,
        day: s.day,
        startedAt: s.startedAt,
        exercises: s.exercises,
      }),
    },
  ),
);
