import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Exercise, WorkoutSetWithDetails } from '../lib/types';

interface SetData {
  reps: string;
  weight: string;
}

interface WorkoutState {
  exercises: Exercise[];
  recentSets: WorkoutSetWithDetails[];
  selectedExerciseId: string | null;
  customExerciseName: string;
  sets: SetData[];
  loading: boolean;
  loadExercises: () => Promise<void>;
  loadRecentSets: (userId: string) => Promise<void>;
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
  selectedExerciseId: null,
  customExerciseName: '',
  sets: [],
  loading: false,
  
  loadExercises: async () => {
    const { data } = await supabase.from('exercises').select('*').order('name');
    set({ exercises: data || [] });
  },
  
  loadRecentSets: async (userId: string) => {
    const { data } = await supabase
      .from('workout_sets')
      .select('*, exercise:exercises(name), workout:workouts(started_at)')
      .eq('workout:workouts.user_id', userId)
      .order('created_at', { ascending: false });
    set({ recentSets: (data as WorkoutSetWithDetails[]) || [] });
  },
  
  setSelectedExercise: (id) => set({ selectedExerciseId: id }),
  setCustomExerciseName: (name) => set({ customExerciseName: name }),
  
  addSet: () => {
    const last = get().sets[get().sets.length - 1];
    set({ sets: [...get().sets, { reps: last?.reps || '', weight: last?.weight || '' }] });
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
      weight: Number(s.weight)
    }));
    
    const { error } = await supabase.from('workout_sets').insert(setsToInsert);
    if (error) return { error };
    
    set({ sets: [], selectedExerciseId: null, customExerciseName: '' });
    await get().loadRecentSets(userId);
    
    return { error: null };
  }
}));
