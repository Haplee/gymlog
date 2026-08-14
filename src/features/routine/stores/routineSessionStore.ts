import { create } from 'zustand';
import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@shared/lib/supabase';
import { devError } from '@shared/lib/devtools';
import { enqueueWorkout, isNetworkError, type OutboxSet } from '@shared/lib/workoutOutbox';
import { resolveOrCreateExercise } from '@shared/lib/resolveOrCreateExercise';
import { useOutboxStore } from '@shared/stores/outboxStore';
import { normalizeExerciseName } from '@shared/lib/progressionCycle';
import type { DayOfWeek, DayRoutine, Routine } from './routineStore';

export interface SessionSet {
  id: string;
  reps: string;
  weight: string;
}

export interface SessionExercise {
  /** Nombre tal cual figura en la rutina; se resuelve a exercise_id al guardar. */
  name: string;
  /** Objetivo de la plantilla, solo informativo en la UI. */
  targetSets?: number;
  targetReps?: string;
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

const makeSet = (reps = '', weight = ''): SessionSet => ({
  id: crypto.randomUUID(),
  reps,
  weight,
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

/** Una serie cuenta si tiene reps > 0 y un peso numérico >= 0 (0 = peso corporal). */
function isValidSet(s: SessionSet): boolean {
  const reps = Number(s.reps);
  const weight = Number(s.weight);
  if (!s.reps.trim() || !Number.isFinite(reps) || reps <= 0) return false;
  if (!s.weight.trim() || !Number.isFinite(weight) || weight < 0) return false;
  return true;
}

function toOutboxSets(sets: SessionSet[], toKg: (w: number) => number): OutboxSet[] {
  return sets.filter(isValidSet).map((s, i) => ({
    set_num: i + 1,
    reps: Number(s.reps),
    weight: toKg(Number(s.weight)),
    is_warmup: false,
    notes: '',
    rpe: '',
    set_type: 'normal',
  }));
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
          exercises: dayRoutine.exercises.map((ex) => ({
            name: ex.name,
            targetSets: ex.sets,
            targetReps: ex.reps,
            // Una fila por serie objetivo, ya con las repeticiones puestas: así
            // registrar la rutina tal cual sale es solo escribir los pesos. Si
            // hay auto-relleno, el peso de la última sesión ya viene escrito.
            sets: Array.from({ length: Math.max(1, ex.sets ?? 1) }, () =>
              makeSet(targetRepsValue(ex.reps), prefills?.[normalizeExerciseName(ex.name)] ?? ''),
            ),
          })),
        });
      },

      addSet: (exerciseIndex) => {
        const exercises = get().exercises.map((ex, i) => {
          if (i !== exerciseIndex) return ex;
          const last = ex.sets.at(-1);
          return { ...ex, sets: [...ex.sets, makeSet(last?.reps ?? '', last?.weight ?? '')] };
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
        // `pending` es solo lo que aún NO se ha escrito: si la red cae a mitad,
        // encolar la lista entera duplicaría los ejercicios ya guardados.
        const queueOffline = async (pending: typeof done, alreadySaved: number) => {
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
          set({ ...emptySession });
          void useOutboxStore.getState().refresh();
          return {
            error: null,
            success: true,
            queued: true,
            savedExercises: alreadySaved + pending.length,
          };
        };

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          return queueOffline(done, 0);
        }

        let saved = 0;
        try {
          for (const ex of done) {
            const exerciseId =
              resolveExerciseId(ex.name) ??
              (await resolveOrCreateExercise(userId, ex.name, DEFAULT_MUSCLE_GROUP));

            const { error } = await supabase.rpc('save_workout_with_sets', {
              p_user_id: userId,
              p_exercise_id: exerciseId,
              p_started_at: started,
              p_finished_at: finished,
              p_sets: ex.sets,
              p_notes: notes,
              p_rating: undefined,
              p_client_id: ex.clientId,
            });
            if (error) throw error;
            saved += 1;
          }

          set({ ...emptySession });
          return { error: null, success: true, savedExercises: saved };
        } catch (err) {
          set({ saving: false });
          if (isNetworkError(err)) {
            return queueOffline(done.slice(saved), saved);
          }
          const message = err instanceof Error ? err.message : 'Error guardando la rutina';
          devError('[RoutineSession] finish:', message);
          return { error: new Error(message), success: false, savedExercises: saved };
        }
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
