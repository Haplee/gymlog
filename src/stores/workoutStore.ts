import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { WorkoutWithSets } from '../lib/types';

interface SetData {
  reps: string;
  weight: string;
}

interface WorkoutState {
  selectedExerciseId: string | null;
  customExerciseName: string;
  sets: SetData[];
  loading: boolean;
  error: string | null;
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

  selectedExerciseId: null,
  customExerciseName: '',
  sets: [],
  loading: false,
  error: null,


  
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
        .upsert({ name: customExerciseName.trim(), user_id: userId, muscle_group: 'Otro' })
        .select()
        .single();
      if (error) return { error, success: false };
      exerciseId = data.id;
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
      
      return { error: null, success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error guardando';
      console.error('[WorkoutStore] saveWorkout:', message);
      return { error: new Error(message), success: false };
    }
  }
}));
