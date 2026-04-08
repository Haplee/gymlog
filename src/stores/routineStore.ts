import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface DayRoutine {
  exercises: string[];
}

interface WeeklyRoutine {
  monday: DayRoutine;
  tuesday: DayRoutine;
  wednesday: DayRoutine;
  thursday: DayRoutine;
  friday: DayRoutine;
  saturday: DayRoutine;
  sunday: DayRoutine;
}

interface RoutineStore {
  routine: WeeklyRoutine;
  loading: boolean;
  setRoutine: (routine: WeeklyRoutine) => void;
  saveToDb: (userId: string) => Promise<void>;
  loadFromDb: (userId: string) => Promise<void>;
  getTodayExercises: () => string[];
  getDayName: () => DayOfWeek;
}

const defaultRoutine: WeeklyRoutine = {
  monday: { exercises: [] },
  tuesday: { exercises: [] },
  wednesday: { exercises: [] },
  thursday: { exercises: [] },
  friday: { exercises: [] },
  saturday: { exercises: [] },
  sunday: { exercises: [] },
};

const dayNames: Record<number, DayOfWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export const useRoutineStore = create<RoutineStore>()(
  persist(
    (set, get) => ({
      routine: defaultRoutine,
      loading: false,
      
      setRoutine: (routine) => set({ routine }),
      
      saveToDb: async (userId: string) => {
        const { routine } = get();
        const { error } = await supabase
          .from('user_routines')
          .upsert({
            user_id: userId,
            routine: routine,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        
        if (error) console.error('Error saving routine:', error);
      },
      
      loadFromDb: async (userId: string) => {
        set({ loading: true });
        const { data } = await supabase
          .from('user_routines')
          .select('routine')
          .eq('user_id', userId)
          .single();
        
        if (data?.routine) {
          set({ routine: data.routine });
        }
        set({ loading: false });
      },
      
      getTodayExercises: () => {
        const day = get().getDayName();
        return get().routine[day].exercises;
      },
      
      getDayName: () => {
        const dayIndex = new Date().getDay();
        return dayNames[dayIndex];
      },
    }),
    { name: 'gymlog-routine' }
  )
);
