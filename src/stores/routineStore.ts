import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  setRoutine: (routine: WeeklyRoutine) => void;
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
      
      setRoutine: (routine) => set({ routine }),
      
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
