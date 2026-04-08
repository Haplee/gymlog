import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface RoutineExercise {
  name: string;
  sets?: number;
  reps?: string;
  notes?: string;
}

export interface DayRoutine {
  name: string;
  exercises: RoutineExercise[];
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  days: Record<DayOfWeek, DayRoutine>;
  isCustom: boolean;
  createdAt: string;
}

interface RoutineStore {
  routines: Routine[];
  activeRoutineId: string | null;
  lastBackup: string | null;
  loading: boolean;
  
  setRoutines: (routines: Routine[]) => void;
  addRoutine: (routine: Routine) => void;
  updateRoutine: (id: string, routine: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  setActiveRoutine: (id: string | null) => void;
  
  getActiveRoutine: () => Routine | null;
  getTodayRoutine: () => DayRoutine | null;
  getDayName: () => DayOfWeek;
  
  saveToDb: (userId: string) => Promise<void>;
  loadFromDb: (userId: string) => Promise<void>;
  checkAndBackup: (userId: string) => Promise<void>;
}

const dayNames: Record<number, DayOfWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export const PREDEFINED_ROUTINES: Routine[] = [
  {
    id: 'full-body',
    name: 'Full Body',
    description: 'Entrenamiento completo 3 días por semana',
    isCustom: false,
    createdAt: new Date().toISOString(),
    days: {
      monday: { name: 'Día 1 - Full Body', exercises: [
        { name: 'Sentadilla', sets: 4, reps: '8-10' },
        { name: 'Press banca', sets: 4, reps: '8-10' },
        { name: 'Peso muerto', sets: 3, reps: '8-10' },
        { name: 'Press militar', sets: 3, reps: '10-12' },
        { name: 'Remo unilateral', sets: 3, reps: '10-12' },
        { name: ' curl bíceps', sets: 3, reps: '12-15' },
        { name: 'Extensión tríceps', sets: 3, reps: '12-15' },
      ]},
      tuesday: { name: 'Descanso', exercises: [] },
      wednesday: { name: 'Día 2 - Full Body', exercises: [
        { name: 'Sentadilla', sets: 4, reps: '8-10' },
        { name: 'Press banca', sets: 4, reps: '8-10' },
        { name: 'Peso muerto', sets: 3, reps: '8-10' },
        { name: 'Press militar', sets: 3, reps: '10-12' },
        { name: 'Remo unilateral', sets: 3, reps: '10-12' },
        { name: ' curl bíceps', sets: 3, reps: '12-15' },
        { name: 'Extensión tríceps', sets: 3, reps: '12-15' },
      ]},
      thursday: { name: 'Descanso', exercises: [] },
      friday: { name: 'Día 3 - Full Body', exercises: [
        { name: 'Sentadilla', sets: 4, reps: '8-10' },
        { name: 'Press banca', sets: 4, reps: '8-10' },
        { name: 'Peso muerto', sets: 3, reps: '8-10' },
        { name: 'Press militar', sets: 3, reps: '10-12' },
        { name: 'Remo unilateral', sets: 3, reps: '10-12' },
        { name: ' curl bíceps', sets: 3, reps: '12-15' },
        { name: 'Extensión tríceps', sets: 3, reps: '12-15' },
      ]},
      saturday: { name: 'Descanso', exercises: [] },
      sunday: { name: 'Descanso', exercises: [] },
    }
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    description: 'Rutina de 6 días dividiendo por grupos musculares',
    isCustom: false,
    createdAt: new Date().toISOString(),
    days: {
      monday: { name: 'Push (Pecho + Hombro + Tríceps)', exercises: [
        { name: 'Press banca', sets: 4, reps: '8-10' },
        { name: 'Press inclinado', sets: 3, reps: '8-10' },
        { name: 'Press militar', sets: 3, reps: '8-10' },
        { name: 'Elevaciones laterales', sets: 3, reps: '12-15' },
        { name: 'Extensión tríceps', sets: 3, reps: '12-15' },
        { name: 'Tríceps cuerda', sets: 3, reps: '12-15' },
      ]},
      tuesday: { name: 'Pull (Espalda + Bíceps)', exercises: [
        { name: 'Peso muerto', sets: 4, reps: '6-8' },
        { name: 'Remo unilateral', sets: 3, reps: '8-10' },
        { name: 'Jalón abierto', sets: 3, reps: '8-10' },
        { name: 'Remo de pie', sets: 3, reps: '10-12' },
        { name: ' curl bíceps', sets: 3, reps: '10-12' },
        { name: 'Martillo', sets: 3, reps: '12-15' },
      ]},
      wednesday: { name: 'Legs (Piernas)', exercises: [
        { name: 'Sentadilla', sets: 4, reps: '8-10' },
        { name: 'Prensa', sets: 3, reps: '10-12' },
        { name: 'Femoral sentado', sets: 3, reps: '10-12' },
        { name: 'Extensiones cuádriceps', sets: 3, reps: '12-15' },
        { name: 'Elevación gemelos', sets: 4, reps: '15-20' },
      ]},
      thursday: { name: 'Push (Pecho + Hombro + Tríceps)', exercises: [
        { name: 'Press banca', sets: 4, reps: '8-10' },
        { name: 'Press inclinado', sets: 3, reps: '8-10' },
        { name: 'Press militar', sets: 3, reps: '8-10' },
        { name: 'Elevaciones laterales', sets: 3, reps: '12-15' },
        { name: 'Extensión tríceps', sets: 3, reps: '12-15' },
        { name: 'Tríceps cuerda', sets: 3, reps: '12-15' },
      ]},
      friday: { name: 'Pull (Espalda + Bíceps)', exercises: [
        { name: 'Peso muerto', sets: 4, reps: '6-8' },
        { name: 'Remo unilateral', sets: 3, reps: '8-10' },
        { name: 'Jalón abierto', sets: 3, reps: '8-10' },
        { name: 'Remo de pie', sets: 3, reps: '10-12' },
        { name: ' curl bíceps', sets: 3, reps: '10-12' },
        { name: 'Martillo', sets: 3, reps: '12-15' },
      ]},
      saturday: { name: 'Legs (Piernas)', exercises: [
        { name: 'Sentadilla', sets: 4, reps: '8-10' },
        { name: 'Prensa', sets: 3, reps: '10-12' },
        { name: 'Femoral sentado', sets: 3, reps: '10-12' },
        { name: 'Extensiones cuádriceps', sets: 3, reps: '12-15' },
        { name: 'Elevación gemelos', sets: 4, reps: '15-20' },
      ]},
      sunday: { name: 'Descanso', exercises: [] },
    }
  },
  {
    id: 'hipertrofia',
    name: 'Hipertrofia',
    description: 'Rutina de 5 días para máximo crecimiento muscular',
    isCustom: false,
    createdAt: new Date().toISOString(),
    days: {
      monday: { name: 'Pecho + Tríceps', exercises: [
        { name: 'Press banca', sets: 4, reps: '8-12' },
        { name: 'Press inclinado', sets: 4, reps: '8-12' },
        { name: 'Aperturas', sets: 3, reps: '12-15' },
        { name: 'Press banca Decline', sets: 3, reps: '10-12' },
        { name: 'Extensión tríceps', sets: 4, reps: '10-12' },
        { name: 'Tríceps cuerda', sets: 3, reps: '12-15' },
      ]},
      tuesday: { name: 'Espalda + Bíceps', exercises: [
        { name: 'Peso muerto', sets: 4, reps: '8-10' },
        { name: 'Jalón abierto', sets: 4, reps: '8-12' },
        { name: 'Remo unilateral', sets: 3, reps: '10-12' },
        { name: 'Remo de pie', sets: 3, reps: '10-12' },
        { name: ' curl bíceps', sets: 4, reps: '10-12' },
        { name: 'Martillo', sets: 3, reps: '12-15' },
      ]},
      wednesday: { name: 'Piernas', exercises: [
        { name: 'Sentadilla', sets: 4, reps: '8-12' },
        { name: 'Prensa', sets: 4, reps: '10-12' },
        { name: 'Femoral sentado', sets: 3, reps: '10-12' },
        { name: 'Extensiones cuádriceps', sets: 3, reps: '12-15' },
        { name: 'Elevación gemelos', sets: 4, reps: '15-20' },
        { name: 'Peso muerto rumano', sets: 3, reps: '10-12' },
      ]},
      thursday: { name: 'Hombro + Abdominales', exercises: [
        { name: 'Press militar', sets: 4, reps: '8-12' },
        { name: 'Elevaciones laterales', sets: 4, reps: '12-15' },
        { name: 'Elevaciones disco', sets: 3, reps: '12-15' },
        { name: 'Face pull', sets: 3, reps: '15-20' },
        { name: 'Crunches', sets: 4, reps: '15-20' },
        { name: 'Plancha', sets: 3, reps: '30-60s' },
      ]},
      friday: { name: 'Pecho + Espalda', exercises: [
        { name: 'Press banca', sets: 4, reps: '8-12' },
        { name: 'Aperturas', sets: 3, reps: '12-15' },
        { name: 'Jalón abierto', sets: 4, reps: '8-12' },
        { name: 'Remo unilateral', sets: 3, reps: '10-12' },
        { name: ' curl bíceps', sets: 3, reps: '10-12' },
        { name: 'Extensión tríceps', sets: 3, reps: '12-15' },
      ]},
      saturday: { name: 'Descanso', exercises: [] },
      sunday: { name: 'Descanso', exercises: [] },
    }
  },
  {
    id: 'fuerza',
    name: 'Fuerza (5x5)',
    description: 'Rutina经典 de fuerza con peso compound',
    isCustom: false,
    createdAt: new Date().toISOString(),
    days: {
      monday: { name: 'A (Sentadilla)', exercises: [
        { name: 'Sentadilla', sets: 5, reps: '5' },
        { name: 'Press banca', sets: 5, reps: '5' },
        { name: 'Remo de pie', sets: 5, reps: '5' },
      ]},
      tuesday: { name: 'B (Peso muerto)', exercises: [
        { name: 'Peso muerto', sets: 5, reps: '5' },
        { name: 'Press militar', sets: 5, reps: '5' },
        { name: 'Jalón abierto', sets: 5, reps: '5' },
      ]},
      wednesday: { name: 'Descanso', exercises: [] },
      thursday: { name: 'A (Sentadilla)', exercises: [
        { name: 'Sentadilla', sets: 5, reps: '5' },
        { name: 'Press banca', sets: 5, reps: '5' },
        { name: 'Remo de pie', sets: 5, reps: '5' },
      ]},
      friday: { name: 'B (Peso muerto)', exercises: [
        { name: 'Peso muerto', sets: 5, reps: '5' },
        { name: 'Press militar', sets: 5, reps: '5' },
        { name: 'Jalón abierto', sets: 5, reps: '5' },
      ]},
      saturday: { name: 'Descanso', exercises: [] },
      sunday: { name: 'Descanso', exercises: [] },
    }
  },
  {
    id: 'principiante',
    name: 'Principiante',
    description: 'Rutina sencilla para empezar en el gimnasio',
    isCustom: false,
    createdAt: new Date().toISOString(),
    days: {
      monday: { name: 'Entreno A', exercises: [
        { name: 'Sentadilla', sets: 3, reps: '10-12' },
        { name: 'Press banca', sets: 3, reps: '10-12' },
        { name: 'Remo con mancuerna', sets: 3, reps: '10-12' },
        { name: ' curl bíceps', sets: 2, reps: '12-15' },
      ]},
      tuesday: { name: 'Descanso', exercises: [] },
      wednesday: { name: 'Entreno B', exercises: [
        { name: 'Sentadilla', sets: 3, reps: '10-12' },
        { name: 'Press militar', sets: 3, reps: '10-12' },
        { name: 'Jalón abierto', sets: 3, reps: '10-12' },
        { name: 'Extensión tríceps', sets: 2, reps: '12-15' },
      ]},
      thursday: { name: 'Descanso', exercises: [] },
      friday: { name: 'Entreno A', exercises: [
        { name: 'Sentadilla', sets: 3, reps: '10-12' },
        { name: 'Press banca', sets: 3, reps: '10-12' },
        { name: 'Remo con mancuerna', sets: 3, reps: '10-12' },
        { name: ' curl bíceps', sets: 2, reps: '12-15' },
      ]},
      saturday: { name: 'Descanso', exercises: [] },
      sunday: { name: 'Descanso', exercises: [] },
    }
  },
];

const defaultRoutines: Routine[] = [...PREDEFINED_ROUTINES];

export const useRoutineStore = create<RoutineStore>()(
  persist(
    (set, get) => ({
      routines: defaultRoutines,
      activeRoutineId: null,
      lastBackup: null,
      loading: false,
      
      setRoutines: (routines) => set({ routines }),
      
      addRoutine: (routine) => {
        const { routines } = get();
        set({ routines: [...routines, routine] });
      },
      
      updateRoutine: (id, updates) => {
        const { routines } = get();
        set({
          routines: routines.map(r => 
            r.id === id ? { ...r, ...updates } : r
          )
        });
      },
      
      deleteRoutine: (id) => {
        const { routines, activeRoutineId } = get();
        set({
          routines: routines.filter(r => r.id !== id),
          activeRoutineId: activeRoutineId === id ? null : activeRoutineId
        });
      },
      
      setActiveRoutine: (id) => set({ activeRoutineId: id }),
      
      getActiveRoutine: () => {
        const { routines, activeRoutineId } = get();
        if (!activeRoutineId) return null;
        return routines.find(r => r.id === activeRoutineId) || null;
      },
      
      getTodayRoutine: () => {
        const activeRoutine = get().getActiveRoutine();
        if (!activeRoutine) return null;
        
        const day = get().getDayName();
        return activeRoutine.days[day] || null;
      },
      
      getDayName: () => {
        const dayIndex = new Date().getDay();
        return dayNames[dayIndex];
      },
      
      saveToDb: async (userId: string) => {
        const { routines, activeRoutineId } = get();
        
        const customRoutines = routines.filter(r => r.isCustom);
        
        const { error } = await supabase
          .from('user_routines')
          .upsert({
            user_id: userId,
            routines: customRoutines,
            active_routine_id: activeRoutineId,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        
        if (error) {
          console.error('Error saving routines:', error);
        }
      },
      
      loadFromDb: async (userId: string) => {
        set({ loading: true });
        
        const { data, error } = await supabase
          .from('user_routines')
          .select('routines, active_routine_id, last_backup')
          .eq('user_id', userId)
          .single();
        
        if (!error && data) {
          const { routines: dbRoutines, active_routine_id, last_backup } = data;
          
          const { routines: predefined } = get();
          
          const customRoutines = (dbRoutines || []) as Routine[];
          const mergedRoutines = [...predefined, ...customRoutines.filter(
            cr => !predefined.some(pr => pr.id === cr.id)
          )];
          
          set({
            routines: mergedRoutines,
            activeRoutineId: active_routine_id,
            lastBackup: last_backup,
            loading: false
          });
        } else {
          set({ loading: false });
        }
      },
      
      checkAndBackup: async (userId: string) => {
        const { lastBackup } = get();
        const now = new Date();
        const twoWeeks = 14 * 24 * 60 * 60 * 1000;
        
        if (lastBackup && (now.getTime() - new Date(lastBackup).getTime()) < twoWeeks) {
          return;
        }
        
        try {
          await get().saveToDb(userId);
          set({ lastBackup: now.toISOString() });
          console.log('[Routine] Backup completed');
        } catch (e) {
          console.error('[Routine] Backup failed:', e);
        }
      },
    }),
    {
      name: 'gymlog-routines',
      partialize: (state) => ({
        routines: state.routines,
        activeRoutineId: state.activeRoutineId,
        lastBackup: state.lastBackup
      })
    }
  )
);