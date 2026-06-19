import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { z } from 'zod';
import { supabase } from '@shared/lib/supabase';
import type { WorkoutWithSets } from '@shared/lib/types';
import { devError } from '@shared/lib/devtools';

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
}

interface WorkoutState extends PersistedWorkout {
  loading: boolean;
  error: string | null;
  customMuscleGroup: string;
  repeatWorkout: (workout: WorkoutWithSets) => void;
  setActiveExercise: (id: string | null) => void;
  setCustomExerciseName: (name: string) => void;
  addSet: () => void;
  setSets: (sets: SetData[]) => void;
  updateSet: (index: number, data: Partial<SetData>) => void;
  removeSet: (index: number) => void;
  removeAllSets: () => void;
  saveWorkout: (userId: string) => Promise<{ error: Error | null; success: boolean }>;
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
      customMuscleGroup: 'Otro',
      sets: [],
      startedAt: null,
      loading: false,
      error: null,
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
        const { activeExerciseId, customExerciseName, customMuscleGroup, sets: setData } = get();

        let exerciseId = activeExerciseId;

        if (!activeExerciseId && customExerciseName.trim()) {
          const { data, error } = await supabase
            .from('exercises')
            .insert({
              name: customExerciseName.trim(),
              user_id: userId,
              muscle_group: customMuscleGroup,
            })
            .select('id')
            .single();
          if (error) return { error, success: false };
          exerciseId = data.id;
        }

        if (!exerciseId) return { error: new Error('Selecciona un ejercicio'), success: false };

        const validSets = setData.filter((s) => {
          const result = SetDataSchema.safeParse(s);
          if (!result.success) return false;
          const reps = Number(s.reps);
          const weight = Number(s.weight);
          if (!Number.isFinite(reps) || reps <= 0) return false;
          if (!Number.isFinite(weight) || weight < 0) return false;
          // Allow weight=0 only on warmup sets (e.g. bodyweight warmup)
          if (!s.isWarmup && weight === 0) return false;
          return true;
        });
        if (!validSets.length)
          return { error: new Error('Añade reps y kg válidas'), success: false };

        try {
          const startedAt = get().startedAt || new Date().toISOString();
          const finishedAt = new Date().toISOString();

          const setsPayload = validSets.map((s, i) => ({
            set_num: i + 1,
            reps: Number(s.reps),
            weight: Number(s.weight),
            is_warmup: !!s.isWarmup,
            notes: s.notes?.trim() || '',
            rpe: s.rpe?.trim() || '',
            set_type: s.setType || 'normal',
          }));

          const { error: rpcError } = await supabase.rpc('save_workout_with_sets', {
            p_user_id: userId,
            p_exercise_id: exerciseId,
            p_started_at: startedAt,
            p_finished_at: finishedAt,
            p_sets: setsPayload,
          });

          if (rpcError) throw rpcError;

          set({
            sets: [],
            activeExerciseId: null,
            customExerciseName: '',
            customMuscleGroup: 'Otro',
            startedAt: null,
          });

          return { error: null, success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Error guardando';
          devError('[WorkoutStore] saveWorkout:', message);
          return { error: new Error(message), success: false };
        }
      },

      clearPersistedState: () =>
        set({
          activeExerciseId: null,
          customExerciseName: '',
          customMuscleGroup: 'Otro',
          sets: [],
          startedAt: null,
        }),
    }),
    {
      name: 'gymlog-workout',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeExerciseId: state.activeExerciseId,
        customExerciseName: state.customExerciseName,
        customMuscleGroup: state.customMuscleGroup,
        sets: state.sets,
        startedAt: state.startedAt,
      }),
    },
  ),
);
