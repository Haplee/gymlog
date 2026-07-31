import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@shared/lib/supabase';
import { devError, devLog } from '@shared/lib/devtools';

export type DayOfWeek =
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

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
  cloneRoutine: (sourceId: string, name?: string) => string | null;
  setActiveRoutine: (id: string | null) => void;

  getActiveRoutine: () => Routine | null;
  getTodayRoutine: () => DayRoutine | null;
  getDayName: () => DayOfWeek;

  saveToDb: (userId: string) => Promise<boolean>;
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
      monday: {
        name: 'Día 1 - Full Body',
        exercises: [
          { name: 'Sentadilla', sets: 4, reps: '8-10' },
          { name: 'Press banca', sets: 4, reps: '8-10' },
          { name: 'Peso muerto', sets: 3, reps: '8-10' },
          { name: 'Press militar', sets: 3, reps: '10-12' },
          { name: 'Remo unilateral', sets: 3, reps: '10-12' },
          { name: ' curl bíceps', sets: 3, reps: '12-15' },
          { name: 'Extensión tríceps', sets: 3, reps: '12-15' },
        ],
      },
      tuesday: { name: 'Descanso', exercises: [] },
      wednesday: {
        name: 'Día 2 - Full Body',
        exercises: [
          { name: 'Sentadilla', sets: 4, reps: '8-10' },
          { name: 'Press banca', sets: 4, reps: '8-10' },
          { name: 'Peso muerto', sets: 3, reps: '8-10' },
          { name: 'Press militar', sets: 3, reps: '10-12' },
          { name: 'Remo unilateral', sets: 3, reps: '10-12' },
          { name: ' curl bíceps', sets: 3, reps: '12-15' },
          { name: 'Extensión tríceps', sets: 3, reps: '12-15' },
        ],
      },
      thursday: { name: 'Descanso', exercises: [] },
      friday: {
        name: 'Día 3 - Full Body',
        exercises: [
          { name: 'Sentadilla', sets: 4, reps: '8-10' },
          { name: 'Press banca', sets: 4, reps: '8-10' },
          { name: 'Peso muerto', sets: 3, reps: '8-10' },
          { name: 'Press militar', sets: 3, reps: '10-12' },
          { name: 'Remo unilateral', sets: 3, reps: '10-12' },
          { name: ' curl bíceps', sets: 3, reps: '12-15' },
          { name: 'Extensión tríceps', sets: 3, reps: '12-15' },
        ],
      },
      saturday: { name: 'Descanso', exercises: [] },
      sunday: { name: 'Descanso', exercises: [] },
    },
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    description: 'Rutina de 6 días dividiendo por grupos musculares',
    isCustom: false,
    createdAt: new Date().toISOString(),
    days: {
      monday: {
        name: 'Push (Pecho + Hombro + Tríceps)',
        exercises: [
          { name: 'Press banca', sets: 4, reps: '8-10' },
          { name: 'Press inclinado', sets: 3, reps: '8-10' },
          { name: 'Press militar', sets: 3, reps: '8-10' },
          { name: 'Elevaciones laterales', sets: 3, reps: '12-15' },
          { name: 'Extensión tríceps', sets: 3, reps: '12-15' },
          { name: 'Tríceps cuerda', sets: 3, reps: '12-15' },
        ],
      },
      tuesday: {
        name: 'Pull (Espalda + Bíceps)',
        exercises: [
          { name: 'Peso muerto', sets: 4, reps: '6-8' },
          { name: 'Remo unilateral', sets: 3, reps: '8-10' },
          { name: 'Jalón abierto', sets: 3, reps: '8-10' },
          { name: 'Remo de pie', sets: 3, reps: '10-12' },
          { name: ' curl bíceps', sets: 3, reps: '10-12' },
          { name: 'Martillo', sets: 3, reps: '12-15' },
        ],
      },
      wednesday: {
        name: 'Legs (Piernas)',
        exercises: [
          { name: 'Sentadilla', sets: 4, reps: '8-10' },
          { name: 'Prensa', sets: 3, reps: '10-12' },
          { name: 'Femoral sentado', sets: 3, reps: '10-12' },
          { name: 'Extensiones cuádriceps', sets: 3, reps: '12-15' },
          { name: 'Elevación gemelos', sets: 4, reps: '15-20' },
        ],
      },
      thursday: {
        name: 'Push (Pecho + Hombro + Tríceps)',
        exercises: [
          { name: 'Press banca', sets: 4, reps: '8-10' },
          { name: 'Press inclinado', sets: 3, reps: '8-10' },
          { name: 'Press militar', sets: 3, reps: '8-10' },
          { name: 'Elevaciones laterales', sets: 3, reps: '12-15' },
          { name: 'Extensión tríceps', sets: 3, reps: '12-15' },
          { name: 'Tríceps cuerda', sets: 3, reps: '12-15' },
        ],
      },
      friday: {
        name: 'Pull (Espalda + Bíceps)',
        exercises: [
          { name: 'Peso muerto', sets: 4, reps: '6-8' },
          { name: 'Remo unilateral', sets: 3, reps: '8-10' },
          { name: 'Jalón abierto', sets: 3, reps: '8-10' },
          { name: 'Remo de pie', sets: 3, reps: '10-12' },
          { name: ' curl bíceps', sets: 3, reps: '10-12' },
          { name: 'Martillo', sets: 3, reps: '12-15' },
        ],
      },
      saturday: {
        name: 'Legs (Piernas)',
        exercises: [
          { name: 'Sentadilla', sets: 4, reps: '8-10' },
          { name: 'Prensa', sets: 3, reps: '10-12' },
          { name: 'Femoral sentado', sets: 3, reps: '10-12' },
          { name: 'Extensiones cuádriceps', sets: 3, reps: '12-15' },
          { name: 'Elevación gemelos', sets: 4, reps: '15-20' },
        ],
      },
      sunday: { name: 'Descanso', exercises: [] },
    },
  },
  {
    id: 'hipertrofia',
    name: 'Hipertrofia',
    description: 'Rutina de 5 días para máximo crecimiento muscular',
    isCustom: false,
    createdAt: new Date().toISOString(),
    days: {
      monday: {
        name: 'Pecho + Tríceps',
        exercises: [
          { name: 'Press banca', sets: 4, reps: '8-12' },
          { name: 'Press inclinado', sets: 4, reps: '8-12' },
          { name: 'Aperturas', sets: 3, reps: '12-15' },
          { name: 'Press banca Decline', sets: 3, reps: '10-12' },
          { name: 'Extensión tríceps', sets: 4, reps: '10-12' },
          { name: 'Tríceps cuerda', sets: 3, reps: '12-15' },
        ],
      },
      tuesday: {
        name: 'Espalda + Bíceps',
        exercises: [
          { name: 'Peso muerto', sets: 4, reps: '8-10' },
          { name: 'Jalón abierto', sets: 4, reps: '8-12' },
          { name: 'Remo unilateral', sets: 3, reps: '10-12' },
          { name: 'Remo de pie', sets: 3, reps: '10-12' },
          { name: ' curl bíceps', sets: 4, reps: '10-12' },
          { name: 'Martillo', sets: 3, reps: '12-15' },
        ],
      },
      wednesday: {
        name: 'Piernas',
        exercises: [
          { name: 'Sentadilla', sets: 4, reps: '8-12' },
          { name: 'Prensa', sets: 4, reps: '10-12' },
          { name: 'Femoral sentado', sets: 3, reps: '10-12' },
          { name: 'Extensiones cuádriceps', sets: 3, reps: '12-15' },
          { name: 'Elevación gemelos', sets: 4, reps: '15-20' },
          { name: 'Peso muerto rumano', sets: 3, reps: '10-12' },
        ],
      },
      thursday: {
        name: 'Hombro + Abdominales',
        exercises: [
          { name: 'Press militar', sets: 4, reps: '8-12' },
          { name: 'Elevaciones laterales', sets: 4, reps: '12-15' },
          { name: 'Elevaciones disco', sets: 3, reps: '12-15' },
          { name: 'Face pull', sets: 3, reps: '15-20' },
          { name: 'Crunches', sets: 4, reps: '15-20' },
          { name: 'Plancha', sets: 3, reps: '30-60s' },
        ],
      },
      friday: {
        name: 'Pecho + Espalda',
        exercises: [
          { name: 'Press banca', sets: 4, reps: '8-12' },
          { name: 'Aperturas', sets: 3, reps: '12-15' },
          { name: 'Jalón abierto', sets: 4, reps: '8-12' },
          { name: 'Remo unilateral', sets: 3, reps: '10-12' },
          { name: ' curl bíceps', sets: 3, reps: '10-12' },
          { name: 'Extensión tríceps', sets: 3, reps: '12-15' },
        ],
      },
      saturday: { name: 'Descanso', exercises: [] },
      sunday: { name: 'Descanso', exercises: [] },
    },
  },
  {
    id: 'fuerza',
    name: 'Fuerza (5x5)',
    description: 'Rutina clásica de fuerza con ejercicios compuestos',
    isCustom: false,
    createdAt: new Date().toISOString(),
    days: {
      monday: {
        name: 'A (Sentadilla)',
        exercises: [
          { name: 'Sentadilla', sets: 5, reps: '5' },
          { name: 'Press banca', sets: 5, reps: '5' },
          { name: 'Remo de pie', sets: 5, reps: '5' },
        ],
      },
      tuesday: {
        name: 'B (Peso muerto)',
        exercises: [
          { name: 'Peso muerto', sets: 5, reps: '5' },
          { name: 'Press militar', sets: 5, reps: '5' },
          { name: 'Jalón abierto', sets: 5, reps: '5' },
        ],
      },
      wednesday: { name: 'Descanso', exercises: [] },
      thursday: {
        name: 'A (Sentadilla)',
        exercises: [
          { name: 'Sentadilla', sets: 5, reps: '5' },
          { name: 'Press banca', sets: 5, reps: '5' },
          { name: 'Remo de pie', sets: 5, reps: '5' },
        ],
      },
      friday: {
        name: 'B (Peso muerto)',
        exercises: [
          { name: 'Peso muerto', sets: 5, reps: '5' },
          { name: 'Press militar', sets: 5, reps: '5' },
          { name: 'Jalón abierto', sets: 5, reps: '5' },
        ],
      },
      saturday: { name: 'Descanso', exercises: [] },
      sunday: { name: 'Descanso', exercises: [] },
    },
  },
  {
    id: 'principiante',
    name: 'Principiante',
    description: 'Rutina sencilla para empezar en el gimnasio',
    isCustom: false,
    createdAt: new Date().toISOString(),
    days: {
      monday: {
        name: 'Entreno A',
        exercises: [
          { name: 'Sentadilla', sets: 3, reps: '10-12' },
          { name: 'Press banca', sets: 3, reps: '10-12' },
          { name: 'Remo con mancuerna', sets: 3, reps: '10-12' },
          { name: ' curl bíceps', sets: 2, reps: '12-15' },
        ],
      },
      tuesday: { name: 'Descanso', exercises: [] },
      wednesday: {
        name: 'Entreno B',
        exercises: [
          { name: 'Sentadilla', sets: 3, reps: '10-12' },
          { name: 'Press militar', sets: 3, reps: '10-12' },
          { name: 'Jalón abierto', sets: 3, reps: '10-12' },
          { name: 'Extensión tríceps', sets: 2, reps: '12-15' },
        ],
      },
      thursday: { name: 'Descanso', exercises: [] },
      friday: {
        name: 'Entreno A',
        exercises: [
          { name: 'Sentadilla', sets: 3, reps: '10-12' },
          { name: 'Press banca', sets: 3, reps: '10-12' },
          { name: 'Remo con mancuerna', sets: 3, reps: '10-12' },
          { name: ' curl bíceps', sets: 2, reps: '12-15' },
        ],
      },
      saturday: { name: 'Descanso', exercises: [] },
      sunday: { name: 'Descanso', exercises: [] },
    },
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    description: 'Cuatro días divididos en tren superior e inferior. Ideal para fuerza.',
    isCustom: false,
    createdAt: new Date().toISOString(),
    days: {
      monday: {
        name: 'Upper A (Fuerza)',
        exercises: [
          { name: 'Press banca', sets: 4, reps: '5-6' },
          { name: 'Remo de pie', sets: 4, reps: '6-8' },
          { name: 'Press militar', sets: 3, reps: '6-8' },
          { name: 'Jalón abierto', sets: 3, reps: '8-10' },
          { name: ' curl bíceps', sets: 3, reps: '10-12' },
          { name: 'Extensión tríceps', sets: 3, reps: '10-12' },
        ],
      },
      tuesday: {
        name: 'Lower A (Fuerza)',
        exercises: [
          { name: 'Sentadilla', sets: 4, reps: '5-6' },
          { name: 'Peso muerto rumano', sets: 3, reps: '6-8' },
          { name: 'Prensa', sets: 3, reps: '8-10' },
          { name: 'Femoral sentado', sets: 3, reps: '10-12' },
          { name: 'Elevación gemelos', sets: 4, reps: '12-15' },
        ],
      },
      wednesday: { name: 'Descanso', exercises: [] },
      thursday: {
        name: 'Upper B (Hipertrofia)',
        exercises: [
          { name: 'Press inclinado', sets: 4, reps: '8-12' },
          { name: 'Remo unilateral', sets: 4, reps: '10-12' },
          { name: 'Elevaciones laterales', sets: 4, reps: '12-15' },
          { name: 'Aperturas', sets: 3, reps: '12-15' },
          { name: 'Martillo', sets: 3, reps: '12-15' },
          { name: 'Tríceps cuerda', sets: 3, reps: '12-15' },
        ],
      },
      friday: {
        name: 'Lower B (Hipertrofia)',
        exercises: [
          { name: 'Peso muerto', sets: 4, reps: '6-8' },
          { name: 'Prensa', sets: 4, reps: '12-15' },
          { name: 'Extensiones cuádriceps', sets: 3, reps: '12-15' },
          { name: 'Femoral sentado', sets: 3, reps: '12-15' },
          { name: 'Elevación gemelos', sets: 4, reps: '15-20' },
        ],
      },
      saturday: { name: 'Descanso', exercises: [] },
      sunday: { name: 'Descanso', exercises: [] },
    },
  },
  {
    id: '531',
    name: '5/3/1 (Wendler)',
    description: 'Cuatro días basados en un levantamiento principal por sesión más accesorios.',
    isCustom: false,
    createdAt: new Date().toISOString(),
    days: {
      monday: {
        name: 'Press militar',
        exercises: [
          { name: 'Press militar', sets: 3, reps: '5/3/1' },
          { name: 'Jalón abierto', sets: 5, reps: '10' },
          { name: 'Elevaciones laterales', sets: 4, reps: '12-15' },
          { name: 'Extensión tríceps', sets: 3, reps: '12-15' },
        ],
      },
      tuesday: {
        name: 'Peso muerto',
        exercises: [
          { name: 'Peso muerto', sets: 3, reps: '5/3/1' },
          { name: 'Sentadilla', sets: 5, reps: '10' },
          { name: 'Femoral sentado', sets: 4, reps: '12-15' },
          { name: 'Plancha', sets: 3, reps: '30-60s' },
        ],
      },
      wednesday: { name: 'Descanso', exercises: [] },
      thursday: {
        name: 'Press banca',
        exercises: [
          { name: 'Press banca', sets: 3, reps: '5/3/1' },
          { name: 'Press militar', sets: 5, reps: '10' },
          { name: ' curl bíceps', sets: 4, reps: '12-15' },
          { name: 'Tríceps cuerda', sets: 3, reps: '12-15' },
        ],
      },
      friday: {
        name: 'Sentadilla',
        exercises: [
          { name: 'Sentadilla', sets: 3, reps: '5/3/1' },
          { name: 'Peso muerto rumano', sets: 5, reps: '10' },
          { name: 'Prensa', sets: 4, reps: '12-15' },
          { name: 'Elevación gemelos', sets: 4, reps: '15-20' },
        ],
      },
      saturday: { name: 'Descanso', exercises: [] },
      sunday: { name: 'Descanso', exercises: [] },
    },
  },
  {
    id: 'balonmano-fuerza',
    name: 'Balonmano + Fuerza',
    description:
      'Cuatro días (L-M-J-V) que compaginan fuerza en los básicos con potencia de lanzamiento, salto y cambio de dirección. Deja el fin de semana libre para partido.',
    isCustom: false,
    createdAt: new Date().toISOString(),
    days: {
      // Lunes y jueves reparten el tren inferior en dominante de rodilla y
      // dominante de cadera. Así el peso muerto y la sentadilla pesada no caen
      // el mismo día y cada uno llega descansado.
      monday: {
        name: 'Inferior — Fuerza (rodilla)',
        exercises: [
          {
            name: 'Power Clean',
            sets: 5,
            reps: '3',
            notes: 'Lo primero del día, en fresco. Velocidad, no fallo: para si la barra se frena.',
          },
          { name: 'Sentadilla', sets: 4, reps: '5', notes: 'Deja 2 repeticiones en recámara.' },
          {
            name: 'Zancada caminando',
            sets: 3,
            reps: '10 por pierna',
            notes: 'Una pierna cada vez: el balonmano se juega a una pierna.',
          },
          {
            name: 'Gemelos de pie',
            sets: 4,
            reps: '12',
            notes: 'El tobillo aguanta cada frenada y cada apoyo del salto.',
          },
          {
            name: 'Plancha lateral',
            sets: 3,
            reps: '30-45s por lado',
            notes: 'Antirrotación: el core sujeta el lanzamiento, no lo genera.',
          },
        ],
      },
      tuesday: {
        name: 'Superior — Fuerza y hombro sano',
        exercises: [
          {
            name: 'Press banca',
            sets: 4,
            reps: '5',
            notes: 'Progresión de carga semana a semana.',
          },
          {
            name: 'Dominadas',
            sets: 4,
            reps: '6',
            notes: 'Con lastre cuando salgan limpias.',
          },
          { name: 'Remo con barra', sets: 4, reps: '8' },
          { name: 'Press militar', sets: 3, reps: '8' },
          {
            name: 'Face pull',
            sets: 3,
            reps: '15',
            notes: 'Innegociable: el hombro que lanza necesita el trabajo de detrás.',
          },
          {
            name: 'Rotación externa con goma',
            sets: 3,
            reps: '15 por brazo',
            notes: 'Manguito rotador. Poco peso, control total.',
          },
        ],
      },
      wednesday: { name: 'Descanso', exercises: [] },
      thursday: {
        name: 'Potencia — Salto y cadera',
        exercises: [
          {
            name: 'Power Snatch',
            sets: 5,
            reps: '2',
            notes: 'Carga ligera y rápida. Es un día de velocidad, no de récords.',
          },
          {
            name: 'Salto al cajón',
            sets: 4,
            reps: '4',
            notes: 'Baja andando, no saltando: el impacto no aporta nada aquí.',
          },
          {
            name: 'Saltos skater',
            sets: 3,
            reps: '6 por lado',
            notes: 'Aterriza y aguanta un segundo. Aquí se entrena la rodilla que frena.',
          },
          {
            name: 'Peso muerto',
            sets: 4,
            reps: '5',
            notes: 'La cadena posterior es el motor del salto y del sprint.',
          },
          {
            name: 'Peso muerto rumano a una pierna',
            sets: 3,
            reps: '8 por pierna',
            notes: 'Isquios y equilibrio. Baja despacio.',
          },
        ],
      },
      friday: {
        name: 'Superior — Volumen y lanzamiento',
        exercises: [
          {
            name: 'Press banca inclinado',
            sets: 4,
            reps: '8',
            notes: 'Sube rápido: el gesto se parece al lanzamiento.',
          },
          { name: 'Jalón al pecho', sets: 4, reps: '10' },
          {
            name: 'Lanzamiento de balón medicinal',
            sets: 4,
            reps: '6 por lado',
            notes: 'De rotación, con los pies plantados. Tan fuerte como puedas.',
          },
          { name: 'Curl bíceps', sets: 3, reps: '12' },
          { name: 'Extensión tríceps', sets: 3, reps: '12' },
          {
            name: 'Oblicuos',
            sets: 3,
            reps: '15 por lado',
            notes: 'Rotación con carga, controlando la vuelta.',
          },
        ],
      },
      saturday: { name: 'Partido o descanso', exercises: [] },
      sunday: { name: 'Descanso', exercises: [] },
    },
  },
];

const defaultRoutines: Routine[] = [...PREDEFINED_ROUTINES];

// Guardado en curso: loadFromDb lo espera antes de leer de la BD para no
// pisar con datos remotos desactualizados una rutina que aún se está subiendo.
let pendingSave: Promise<boolean> | null = null;

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
          routines: routines.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        });
      },

      deleteRoutine: (id) => {
        const { routines, activeRoutineId } = get();
        set({
          routines: routines.filter((r) => r.id !== id),
          activeRoutineId: activeRoutineId === id ? null : activeRoutineId,
        });
      },

      cloneRoutine: (sourceId, name) => {
        const { routines } = get();
        const source = routines.find((r) => r.id === sourceId);
        if (!source) return null;

        const newId = `custom-${Date.now()}`;
        const clone: Routine = {
          id: newId,
          name: name?.trim() || `${source.name} (copia)`,
          description: source.description,
          isCustom: true,
          createdAt: new Date().toISOString(),
          // Deep clone days so edits to the copy never mutate the source template.
          // structuredClone requiere Chromium 98+ / Safari 15.4+ — cubierto por
          // los WebView de Capacitor y los navegadores que soporta la PWA.
          days: structuredClone(source.days),
        };

        set({ routines: [...routines, clone] });
        return newId;
      },

      setActiveRoutine: (id) => set({ activeRoutineId: id }),

      getActiveRoutine: () => {
        const { routines, activeRoutineId } = get();
        if (!activeRoutineId) return null;
        return routines.find((r) => r.id === activeRoutineId) || null;
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
        const doSave = async (): Promise<boolean> => {
          const { routines, activeRoutineId, lastBackup } = get();

          const customRoutines = routines.filter((r) => r.isCustom);

          // La tabla real tiene una sola columna `routine` (jsonb): la usamos como
          // contenedor de las rutinas custom + estado.
          const { error } = await supabase.from('user_routines').upsert(
            {
              user_id: userId,
              routine: { routines: customRoutines, activeRoutineId, lastBackup },
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          );

          if (error) {
            devError('Error saving routines:', error);
            return false;
          }
          // Cada guardado explícito (cambios de rutina, logout) cuenta como
          // backup: así la ventana de 3 días de checkAndBackup no depende solo
          // del lastBackup persistido en localStorage.
          set({ lastBackup: new Date().toISOString() });
          return true;
        };

        const save = doSave();
        pendingSave = save;
        try {
          return await save;
        } finally {
          if (pendingSave === save) pendingSave = null;
        }
      },

      loadFromDb: async (userId: string) => {
        set({ loading: true });

        // Si hay un guardado en vuelo, esperar a que termine: leer la BD a
        // mitad de un upsert devolvería el estado anterior y desharía cambios.
        if (pendingSave) await pendingSave.catch(() => {});

        const { data, error } = await supabase
          .from('user_routines')
          .select('routine')
          .eq('user_id', userId)
          .maybeSingle();

        const container = (data?.routine ?? null) as {
          routines?: Routine[];
          activeRoutineId?: string | null;
          lastBackup?: string | null;
        } | null;

        if (!error && container) {
          const remoteCustom = ((container.routines || []) as Routine[]).filter(
            (cr) => !PREDEFINED_ROUTINES.some((pr) => pr.id === cr.id),
          );

          // Merge no destructivo: lo local es la fuente de verdad (la BD es un
          // backup). Una rutina creada/editada aquí cuyo saveToDb falló no debe
          // desaparecer al recargar; las remotas que no existen localmente se
          // restauran (otro dispositivo / reinstalación).
          const localCustom = get().routines.filter((r) => r.isCustom);
          const localIds = new Set(localCustom.map((r) => r.id));
          const remoteOnly = remoteCustom.filter((r) => !localIds.has(r.id));
          const mergedRoutines = [...PREDEFINED_ROUTINES, ...localCustom, ...remoteOnly];

          const remoteIds = new Set(remoteCustom.map((r) => r.id));
          const hasUnsyncedLocal = localCustom.some((r) => !remoteIds.has(r.id));

          set({
            routines: mergedRoutines,
            // Conserva la selección local si existe; la remota solo restaura.
            activeRoutineId: get().activeRoutineId ?? container.activeRoutineId ?? null,
            lastBackup: container.lastBackup ?? get().lastBackup ?? null,
            loading: false,
          });

          // Re-sube las rutinas locales que la BD aún no conoce (guardado
          // previo fallido u offline).
          if (hasUnsyncedLocal) void get().saveToDb(userId);
        } else {
          set({ loading: false });
        }
      },

      checkAndBackup: async (userId: string) => {
        const { lastBackup } = get();
        const now = new Date();
        const threeDays = 3 * 24 * 60 * 60 * 1000;

        if (lastBackup && now.getTime() - new Date(lastBackup).getTime() < threeDays) {
          return;
        }

        try {
          await get().saveToDb(userId);
          set({ lastBackup: now.toISOString() });
          devLog('[Routine] Backup completed');
        } catch (e) {
          devError('[Routine] Backup failed:', e);
        }
      },
    }),
    {
      name: 'gymlog-routines',
      partialize: (state) => ({
        routines: state.routines,
        activeRoutineId: state.activeRoutineId,
        lastBackup: state.lastBackup,
      }),
      /**
       * Las plantillas se vuelven a inyectar en cada arranque en vez de salir
       * del almacenamiento.
       *
       * Por defecto, `persist` sustituye el estado inicial por el guardado, y
       * el guardado incluye la lista de plantillas tal y como estaba el día que
       * se instaló la app. Resultado: una plantilla nueva solo la veía quien
       * instalase de cero, y quien ya usaba GymLog no la recibía nunca.
       *
       * Del disco solo se conservan las rutinas propias. Es seguro porque las
       * plantillas no se pueden editar (editar clona) ni borrar (el botón solo
       * sale en las propias), así que aquí no se pisa nada del usuario.
       */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<RoutineStore>;
        const custom = (saved.routines ?? []).filter((r) => r.isCustom);
        return {
          ...current,
          ...saved,
          routines: [...PREDEFINED_ROUTINES, ...custom],
        };
      },
      /**
       * Las plantillas se vuelven a inyectar en cada arranque en vez de salir
       * del almacenamiento.
       *
       * Por defecto, `persist` sustituye el estado inicial por el guardado, y
       * el guardado incluye la lista de plantillas tal y como estaba el día que
       * se instaló la app. Resultado: una plantilla nueva solo la veía quien
       * instalase de cero, y quien ya usaba GymLog no la recibía nunca.
       *
       * Del disco solo se conservan las rutinas propias. Es seguro porque las
       * plantillas no se pueden editar (editar clona) ni borrar (el botón solo
       * sale en las propias), así que aquí no se pisa nada del usuario.
       */
    },
  ),
);
