import { create } from 'zustand';
import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createThrottledLocalStorage } from '@shared/lib/throttledStorage';
import { z } from 'zod';
import { supabase } from '@shared/lib/supabase';
import type { WorkoutWithSets } from '@shared/lib/types';
import { devError } from '@shared/lib/devtools';
import { enqueueWorkout, isNetworkError } from '@shared/lib/workoutOutbox';
import { resolveOrCreateExercise } from '@shared/lib/resolveOrCreateExercise';
import { useOutboxStore } from '@shared/stores/outboxStore';
import { reconcileReminders } from '@shared/lib/reminderReconcile';

const SetDataSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  reps: z.string().min(1, 'Min 1 rep').max(4, 'Max 9999'),
  weight: z.string().min(1, 'Min 1 kg').max(6, 'Max 999999'),
  isWarmup: z.boolean().default(false),
  notes: z.string().max(500).optional().default(''),
  // RPE 1-10 como string ('' = sin valor). Validado a SMALLINT en la RPC.
  rpe: z.string().max(2).optional().default(''),
  // Tipo de serie avanzado. 'normal' por defecto.
  setType: z.enum(['normal', 'dropset', 'rest_pause', 'amrap']).optional().default('normal'),
});

type SetData = z.infer<typeof SetDataSchema>;

interface PersistedWorkout {
  activeExerciseId: string | null;
  customExerciseName: string;
  customMuscleGroup: string;
  sets: SetData[];
  startedAt: string | null;
  sessionNotes: string;
  sessionRating: number | null;
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
  ) => Promise<{ error: Error | null; success: boolean; queued?: boolean }>;
  clearPersistedState: () => void;
}

const makeSet = (reps = '', weight = '', isWarmup = false, notes = '', rpe = ''): SetData => ({
  id: crypto.randomUUID(),
  reps,
  weight,
  isWarmup,
  notes,
  rpe,
  setType: 'normal',
});

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
        set({ sets: [...get().sets, last ? makeSet(last.reps, last.weight) : makeSet()] });
      },

      setSets: (newSets: SetData[]) => set({ sets: newSets }),

      updateSet: (index: number, data: Partial<SetData>) => {
        const newSets = [...get().sets];
        newSets[index] = { ...newSets[index], ...data };
        set({ sets: newSets });
      },

      removeSet: (index: number) => {
        set({ sets: get().sets.filter((_, i) => i !== index) });
      },

      removeAllSets: () => {
        set({ sets: [] });
      },

      saveWorkout: async (userId: string) => {
        const {
          activeExerciseId,
          customExerciseName,
          customMuscleGroup,
          sets: setData,
          sessionNotes,
          sessionRating,
          bodyweightMode,
          bodyWeightKg,
        } = get();

        if (!activeExerciseId && !customExerciseName.trim()) {
          return { error: new Error('Selecciona un ejercicio'), success: false };
        }

        const validSets = setData.filter((s) => {
          const result = SetDataSchema.safeParse(s);
          if (!result.success) return false;
          const reps = Number(s.reps);
          const weight = Number(s.weight);
          if (!Number.isFinite(reps) || reps <= 0) return false;
          if (!Number.isFinite(weight) || weight < 0) return false;
          // En modo peso corporal el kg introducido es lastre y puede ser 0.
          if (bodyweightMode) return true;
          // Allow weight=0 only on warmup sets (e.g. bodyweight warmup)
          if (!s.isWarmup && weight === 0) return false;
          return true;
        });
        if (!validSets.length)
          return { error: new Error('Añade reps y kg válidas'), success: false };

        const startedAt = get().startedAt || new Date().toISOString();
        const finishedAt = new Date().toISOString();
        const notes = sessionNotes.trim() || undefined;
        const rating = sessionRating ?? undefined;

        // En modo peso corporal el kg introducido es lastre; el peso guardado es
        // (peso corporal vigente + lastre) para que volumen/PRs sean correctos.
        const effectiveWeight = (s: SetData): number => {
          const entered = Number(s.weight) || 0;
          return bodyweightMode ? (bodyWeightKg ?? 0) + entered : Number(s.weight);
        };

        const setsPayload = validSets.map((s, i) => ({
          set_num: i + 1,
          reps: Number(s.reps),
          weight: effectiveWeight(s),
          is_warmup: !!s.isWarmup,
          notes: s.notes?.trim() || '',
          rpe: s.rpe?.trim() || '',
          set_type: s.setType || 'normal',
        }));

        const resetState = () =>
          set({
            sets: [],
            activeExerciseId: null,
            customExerciseName: '',
            customMuscleGroup: DEFAULT_MUSCLE_GROUP,
            startedAt: null,
            sessionNotes: '',
            sessionRating: null,
          });

        // Encola el entreno en IndexedDB para sincronizarlo al volver la conexión.
        const queueOffline = async () => {
          await enqueueWorkout({
            id: crypto.randomUUID(),
            userId,
            exerciseId: activeExerciseId,
            customExerciseName: customExerciseName.trim(),
            customMuscleGroup,
            startedAt,
            finishedAt,
            sets: setsPayload,
            notes,
            rating,
            createdAt: new Date().toISOString(),
          });
          resetState();
          void useOutboxStore.getState().refresh();
          // Ya ha entrenado hoy: silencia los recordatorios de hoy al instante.
          void reconcileReminders(userId, { trainedToday: true });
          return { error: null, success: true, queued: true };
        };

        // Sin conexión: encolar directamente (incluye crear ejercicio custom al sync).
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          return queueOffline();
        }

        try {
          let exerciseId = activeExerciseId;
          if (!exerciseId && customExerciseName.trim()) {
            exerciseId = await resolveOrCreateExercise(
              userId,
              customExerciseName,
              customMuscleGroup,
            );
          }
          if (!exerciseId) return { error: new Error('Selecciona un ejercicio'), success: false };

          const { error: rpcError } = await supabase.rpc('save_workout_with_sets', {
            p_user_id: userId,
            p_exercise_id: exerciseId,
            p_started_at: startedAt,
            p_finished_at: finishedAt,
            p_sets: setsPayload,
            p_notes: notes,
            p_rating: rating,
          });

          if (rpcError) throw rpcError;

          resetState();
          // Ya ha entrenado hoy: silencia los recordatorios de hoy al instante.
          void reconcileReminders(userId, { trainedToday: true });
          return { error: null, success: true };
        } catch (err) {
          // Error de red → encolar para reintentar. Otros errores → reportar.
          if (isNetworkError(err)) {
            return queueOffline();
          }
          const message = err instanceof Error ? err.message : 'Error guardando';
          devError('[WorkoutStore] saveWorkout:', message);
          return { error: new Error(message), success: false };
        }
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
      }),
    },
  ),
);
