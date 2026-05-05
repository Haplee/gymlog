import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { z } from 'zod';
import { supabase } from '@shared/lib/supabase';
import type { WorkoutWithSets } from '@shared/lib/types';

const SetDataSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  reps: z.string().min(1, 'Min 1 rep').max(4, 'Max 9999'),
  weight: z.string().min(1, 'Min 1 kg').max(6, 'Max 999999'),
  isWarmup: z.boolean().default(false),
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
  updateSet: (index: number, data: Partial<SetData>) => void;
  removeSet: (index: number) => void;
  removeAllSets: () => void;
  saveWorkout: (userId: string) => Promise<{ error: Error | null; success: boolean }>;
  clearPersistedState: () => void;
}

const makeSet = (reps = '', weight = '', isWarmup = false): SetData => ({
  id: crypto.randomUUID(),
  reps,
  weight,
  isWarmup,
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
        set({
          activeExerciseId: exerciseId,
          customExerciseName: '',
          sets: workout.sets.map((s) => makeSet(String(s.reps), String(s.weight))),
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
      setCustomMuscleGroup: (group: string) => set({ customMuscleGroup: group }),

      addSet: () => {
        const last = get().sets.at(-1);
        set({ sets: [...get().sets, last ? makeSet(last.reps, last.weight) : makeSet()] });
      },

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
            .upsert({
              name: customExerciseName.trim(),
              user_id: userId,
              muscle_group: customMuscleGroup,
            })
            .select()
            .single();
          if (error) return { error, success: false };
          exerciseId = data.id;
        }

        if (!exerciseId) return { error: new Error('Selecciona un ejercicio'), success: false };

        const validSets = setData.filter((s) => {
          const result = SetDataSchema.safeParse(s);
          return result.success && Number(s.reps) > 0 && Number(s.weight) > 0;
        });
        if (!validSets.length)
          return { error: new Error('Añade reps y kg válidas'), success: false };

        try {
          const { data: wo, error: woError } = await supabase
            .from('workouts')
            .insert({
              user_id: userId,
              started_at: get().startedAt || new Date().toISOString(),
              finished_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (woError) throw woError;
          if (!wo) throw new Error('Error creando workout');

          const setsToInsert = validSets.map((s, i) => ({
            workout_id: wo.id,
            exercise_id: exerciseId,
            set_num: i + 1,
            reps: Number(s.reps),
            weight: Number(s.weight),
            notes: null,
          }));

          const { error: insertError } = await supabase.from('workout_sets').insert(setsToInsert);
          if (insertError) throw insertError;

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
          console.error('[WorkoutStore] saveWorkout:', message);
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
        sets: state.sets,
        startedAt: state.startedAt,
      }),
    },
  ),
);
