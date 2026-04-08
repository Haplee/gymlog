import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Exercise, WorkoutSetWithDetails, WorkoutWithSets, PersonalRecord } from '../lib/types';

interface SetData {
  reps: string;
  weight: string;
  notes?: string;
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
  loadExercises: (userId?: string) => Promise<void>;
  loadRecentSets: (userId: string) => Promise<void>;
  loadWorkouts: (userId: string) => Promise<void>;
  loadPersonalRecords: (userId: string) => Promise<void>;
  repeatWorkout: (workout: WorkoutWithSets) => void;
  setSelectedExercise: (id: string | null) => void;
  setCustomExerciseName: (name: string) => void;
  addSet: () => void;
  updateSet: (index: number, data: Partial<SetData>) => void;
  removeSet: (index: number) => void;
  saveWorkout: (userId: string) => Promise<{ error: Error | null }>;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  exercises: [],
  recentSets: [],
  workouts: [],
  personalRecords: {},
  selectedExerciseId: null,
  customExerciseName: '',
  sets: [],
  loading: false,
  
  loadExercises: async (userId?: string) => {
    let exercises: Exercise[] = [];
    
    if (userId) {
      const { data: userExercises } = await supabase
        .from('exercises')
        .select('id')
        .eq('user_id', userId);
      
      const userExerciseIds = userExercises?.map(e => e.id) || [];
      
      let usage: Record<string, number> = {};
      
      if (userExerciseIds.length > 0) {
        const { data: usageData } = await supabase
          .from('workout_sets')
          .select('exercise_id')
          .in('exercise_id', userExerciseIds);

        usageData?.forEach(s => {
          usage[s.exercise_id] = (usage[s.exercise_id] || 0) + 1;
        });
      }

      const { data: userExData } = await supabase
        .from('exercises')
        .select('*')
        .eq('user_id', userId);
      
      const { data: globalExData } = await supabase
        .from('exercises')
        .select('*')
        .is('user_id', null)
        .order('name');

      const allEx = [...(userExData || []), ...(globalExData || [])];
      exercises = allEx.sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0));
    } else {
      const { data } = await supabase.from('exercises').select('*').order('name');
      exercises = data || [];
    }
    
    set({ exercises });
  },
  
  loadRecentSets: async (userId: string) => {
    // Primero obtenemos los workout IDs del usuario, luego los sets.
    // El filtro .eq sobre una foreign table no funciona en Supabase JS v2.
    const { data: workoutIds } = await supabase
      .from('workouts')
      .select('id')
      .eq('user_id', userId);

    if (!workoutIds || workoutIds.length === 0) {
      set({ recentSets: [] });
      return;
    }

    const ids = workoutIds.map((w) => w.id);

    const { data } = await supabase
      .from('workout_sets')
      .select('*, exercise:exercises(name), workout:workouts(started_at)')
      .in('workout_id', ids)
      .order('created_at', { ascending: false })
      .limit(100);

    set({ recentSets: (data as WorkoutSetWithDetails[]) || [] });
  },
  
  loadWorkouts: async (userId: string) => {
    const { data: workoutIds } = await supabase
      .from('workouts')
      .select('id, started_at, ended_at')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(20);

    if (!workoutIds || workoutIds.length === 0) {
      set({ workouts: [] });
      return;
    }

    const ids = workoutIds.map(w => w.id);

    const { data: allSets } = await supabase
      .from('workout_sets')
      .select('*, exercise:exercises(name)')
      .in('workout_id', ids);

    const workoutsWithSets: WorkoutWithSets[] = workoutIds.map(wo => {
      const sets = (allSets || []).filter(s => s.workout_id === wo.id);
      return {
        id: wo.id,
        started_at: wo.started_at,
        ended_at: wo.ended_at,
        sets: sets as WorkoutSetWithDetails[]
      };
    });

    set({ workouts: workoutsWithSets });
  },
  
  loadPersonalRecords: async (userId: string) => {
    const { data } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', userId);

    const prMap: Record<string, PersonalRecord> = {};
    data?.forEach(pr => {
      prMap[pr.exercise_id] = pr;
    });
    set({ personalRecords: prMap });
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
        weight: String(s.weight),
        notes: s.notes || ''
      }))
    });
  },
  
  setSelectedExercise: (id) => set({ selectedExerciseId: id }),
  setCustomExerciseName: (name) => set({ customExerciseName: name }),
  
  addSet: () => {
    const last = get().sets[get().sets.length - 1];
    set({ sets: [...get().sets, { reps: last?.reps || '', weight: last?.weight || '', notes: '' }] });
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
      if (error) return { error };
      exerciseId = data.id;
      await get().loadExercises();
    }
    
    if (!exerciseId) return { error: new Error('Selecciona un ejercicio') };
    
    const validSets = setData.filter(s => s.reps && s.weight);
    if (!validSets.length) return { error: new Error('Añade reps y kg') };
    
    const { data: wo } = await supabase
      .from('workouts')
      .insert({ user_id: userId, started_at: new Date().toISOString() })
      .select()
      .single();
    
    if (!wo) return { error: new Error('Error creando workout') };
    
    const setsToInsert = validSets.map((s, i) => ({
      workout_id: wo.id,
      exercise_id: exerciseId,
      set_num: i + 1,
      reps: Number(s.reps),
      weight: Number(s.weight),
      notes: s.notes || null
    }));
    
    const { error } = await supabase.from('workout_sets').insert(setsToInsert);
    if (error) return { error };
    
    set({ sets: [], selectedExerciseId: null, customExerciseName: '' });
    await get().loadRecentSets(userId);
    
    return { error: null };
  }
}));
