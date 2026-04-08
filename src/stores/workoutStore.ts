import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Exercise, WorkoutSetWithDetails, WorkoutWithSets, PersonalRecord } from '../lib/types';

interface SetData {
  reps: string;
  weight: string;
}

interface WorkoutState {
  exercises: Exercise[];
  recentSets: WorkoutSetWithDetails[];
  workouts: WorkoutWithSets[];
  personalRecords: Record<string, PersonalRecord>;
  selectedExerciseId: string | null;
  customExerciseName: string;
  sets: SetData[];
  loading: boolean;
  error: string | null;
  loadExercises: (userId?: string) => Promise<void>;
  loadRecentSets: (userId: string) => Promise<void>;
  loadWorkouts: (userId: string) => Promise<void>;
  loadPersonalRecords: (userId: string) => Promise<void>;
  getLastWeight: (exerciseId: string) => string;
  repeatWorkout: (workout: WorkoutWithSets) => void;
  setSelectedExercise: (id: string | null) => void;
  setCustomExerciseName: (name: string) => void;
  addSet: () => void;
  updateSet: (index: number, data: Partial<SetData>) => void;
  removeSet: (index: number) => void;
  saveWorkout: (userId: string) => Promise<{ error: Error | null; success: boolean }>;
}

const initialSet: SetData = { reps: '', weight: '' };

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  exercises: [],
  recentSets: [],
  workouts: [],
  personalRecords: {},
  selectedExerciseId: null,
  customExerciseName: '',
  sets: [],
  loading: false,
  error: null,

  getLastWeight: (exerciseId: string) => {
    const sets = get().recentSets;
    const exerciseSets = sets.filter(s => s.exercise_id === exerciseId);
    if (exerciseSets.length > 0) {
      return String(exerciseSets[0].weight);
    }
    return '';
  },

  loadExercises: async (userId?: string) => {
    try {
      let exercises: Exercise[] = [];
      
      if (userId) {
        const { data: userExercises, error: userExError } = await supabase
          .from('exercises')
          .select('id')
          .eq('user_id', userId);
        
        if (userExError) throw userExError;
        
        const userExerciseIds = userExercises?.map(e => e.id) || [];
        
        let usage: Record<string, number> = {};
        
        if (userExerciseIds.length > 0) {
          const { data: usageData, error: usageError } = await supabase
            .from('workout_sets')
            .select('exercise_id')
            .in('exercise_id', userExerciseIds);

          if (!usageError && usageData) {
            usageData.forEach(s => {
              usage[s.exercise_id] = (usage[s.exercise_id] || 0) + 1;
            });
          }
        }

        const { data: userExData, error: userDataError } = await supabase
          .from('exercises')
          .select('*')
          .eq('user_id', userId);
        
        if (userDataError) throw userDataError;
        
        const { data: globalExData, error: globalError } = await supabase
          .from('exercises')
          .select('*')
          .is('user_id', null)
          .order('name');
        
        if (globalError) throw globalError;

        const allEx = [...(userExData || []), ...(globalExData || [])];
        exercises = allEx.sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0));
      } else {
        const { data, error } = await supabase.from('exercises').select('*').order('name');
        if (error) throw error;
        exercises = data || [];
      }
      
      set({ exercises, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando ejercicios';
      console.error('[WorkoutStore] loadExercises:', message);
      set({ error: message });
    }
  },
  
  loadRecentSets: async (userId: string) => {
    set({ loading: true });
    try {
      const { data: workoutIds, error: woError } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(10);

      if (woError) throw woError;

      if (!workoutIds || workoutIds.length === 0) {
        set({ recentSets: [], loading: false, error: null });
        return;
      }

      const ids = workoutIds.map((w) => w.id);

      const { data, error: setsError } = await supabase
        .from('workout_sets')
        .select('*, exercise:exercises(name), workout:workouts(started_at)')
        .in('workout_id', ids)
        .order('created_at', { ascending: false })
        .limit(50);

      if (setsError) throw setsError;

      set({ recentSets: (data as WorkoutSetWithDetails[]) || [], loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando series';
      console.error('[WorkoutStore] loadRecentSets:', message);
      set({ loading: false, error: message });
    }
  },
  
  loadWorkouts: async (userId: string) => {
    try {
      const { data: workoutIds, error } = await supabase
        .from('workouts')
        .select('id, started_at, ended_at')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (!workoutIds || workoutIds.length === 0) {
        set({ workouts: [], error: null });
        return;
      }

      const ids = workoutIds.map(w => w.id);

      const { data: allSets, error: setsError } = await supabase
        .from('workout_sets')
        .select('*, exercise:exercises(name)')
        .in('workout_id', ids);

      if (setsError) throw setsError;

      const workoutsWithSets: WorkoutWithSets[] = workoutIds.map(wo => {
        const sets = (allSets || []).filter(s => s.workout_id === wo.id);
        return {
          id: wo.id,
          started_at: wo.started_at,
          ended_at: wo.ended_at,
          sets: sets as WorkoutSetWithDetails[]
        };
      });

      set({ workouts: workoutsWithSets, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando entrenamientos';
      console.error('[WorkoutStore] loadWorkouts:', message);
      set({ error: message });
    }
  },
  
  loadPersonalRecords: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const prMap: Record<string, PersonalRecord> = {};
      data?.forEach(pr => {
        prMap[pr.exercise_id] = pr;
      });
      set({ personalRecords: prMap, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando PRs';
      console.error('[WorkoutStore] loadPersonalRecords:', message);
      set({ error: message });
    }
  },
  
  repeatWorkout: (workout: WorkoutWithSets) => {
    if (workout.sets.length === 0) return;
    
    const firstSet = workout.sets[0];
    const exerciseId = firstSet.exercise_id;
    
    set({
      selectedExerciseId: exerciseId,
      customExerciseName: '',
      sets: workout.sets.map(s => ({
        reps: String(s.reps),
        weight: String(s.weight)
      }))
    });
  },
  
  setSelectedExercise: (id) => set({ selectedExerciseId: id }),
  setCustomExerciseName: (name) => set({ customExerciseName: name }),
  
  addSet: () => {
    const last = get().sets[get().sets.length - 1];
    set({ sets: [...get().sets, last ? { reps: last.reps, weight: last.weight } : { ...initialSet }] });
  },
  
  updateSet: (index, data) => {
    const newSets = [...get().sets];
    newSets[index] = { ...newSets[index], ...data };
    set({ sets: newSets });
  },
  
  removeSet: (index) => {
    set({ sets: get().sets.filter((_, i) => i !== index) });
  },
  
  saveWorkout: async (userId) => {
    const { selectedExerciseId, customExerciseName, sets: setData } = get();
    
    let exerciseId = selectedExerciseId;
    
    if (!selectedExerciseId && customExerciseName.trim()) {
      const { data, error } = await supabase
        .from('exercises')
        .upsert({ name: customExerciseName.trim(), user_id: userId, muscle_group: 'Personalizado' })
        .select()
        .single();
      if (error) return { error, success: false };
      exerciseId = data.id;
      await get().loadExercises();
    }
    
    if (!exerciseId) return { error: new Error('Selecciona un ejercicio'), success: false };
    
    const validSets = setData.filter(s => s.reps && s.weight);
    if (!validSets.length) return { error: new Error('Añade reps y kg'), success: false };
    
    try {
      const { data: wo, error: woError } = await supabase
        .from('workouts')
        .insert({ user_id: userId, started_at: new Date().toISOString() })
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
        notes: null
      }));
      
      const { error: insertError } = await supabase.from('workout_sets').insert(setsToInsert);
      if (insertError) throw insertError;
      
      set({ sets: [], selectedExerciseId: null, customExerciseName: '' });
      await get().loadRecentSets(userId);
      
      return { error: null, success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error guardando';
      console.error('[WorkoutStore] saveWorkout:', message);
      return { error: new Error(message), success: false };
    }
  }
}));
