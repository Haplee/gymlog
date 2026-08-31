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
  /**
   * Como se registra el ejercicio. **Ausente = `reps`**, y por eso ninguna
   * rutina guardada hasta hoy necesita migrarse: el campo simplemente no esta.
   * La regla vive en `modeOfPlanned` (`@shared/lib/setShape`); aqui solo se
   * declara el hueco donde se guarda.
   *
   * No existe `'cardio'`: el cardio tiene su propia pantalla y su propio
   * temporizador, no es un ejercicio dentro del plan de fuerza.
   */
  mode?: 'reps' | 'time';
  /**
   * El objetivo es **por lado**: «3 x 12 por lado» son 24 repeticiones de
   * trabajo, no 12. Se propone desde `exercises.is_bilateral` al anadir, pero
   * manda lo que diga el plan: la misma zancada se puede planificar de las dos
   * formas y quien decide es quien entrena.
   */
  perSide?: boolean;
  /** Segundos por serie cuando `mode === 'time'`. Ignorado en modo `reps`. */
  durationSeconds?: number;
  /**
   * Superserie: los ejercicios **consecutivos** que compartan este id se hacen
   * encadenados, sin descanso entre ellos.
   *
   * Vive en el plan y no en la serie registrada. En el historial una superserie
   * son series de dos ejercicios del mismo entreno, que es lo que son; añadir
   * una columna a `workout_sets` para poder reconstruir el emparejado sería
   * pagar un cambio de esquema por una pregunta que nadie ha hecho todavía.
   *
   * Se exige que sean consecutivos a propósito: un grupo con un ejercicio
   * suelto en medio no es una superserie, es un id repetido por error.
   */
  supersetId?: string;
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

/**
 * Reorganizacion puntual de la semana en curso: «el martes no pude, lo paso al
 * viernes».
 *
 * `map` va del dia del calendario al dia de la rutina cuyo contenido se muestra
 * ahi (`null` = ese dia queda libre). Se guarda la referencia al dia de origen,
 * no una copia de los ejercicios: asi editar la rutina se sigue viendo en el
 * dia movido, y la rutina base nunca se toca.
 *
 * `weekStart` es lo que hace que sea «solo para esta semana»: en cuanto el
 * lunes actual deja de coincidir, el plan caduca solo y la rutina vuelve a su
 * sitio sin que el usuario tenga que deshacer nada.
 */
export interface WeekPlan {
  /** Lunes (yyyy-mm-dd, hora local) de la semana a la que aplica. */
  weekStart: string;
  map: Record<DayOfWeek, DayOfWeek | null>;
}

export const DAY_ORDER: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** Lunes de la semana de `date`, en formato yyyy-mm-dd y en hora local. */
export function weekStartOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): 0 = domingo. El domingo pertenece a la semana que empezo 6 dias antes.
  d.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Hoy en yyyy-mm-dd y en hora local, igual que `weekStartOf`.
 *
 * Las fechas del calendario son dias naturales de quien entrena, no instantes
 * UTC: con `toISOString()` un bloque programado para el 1 de septiembre se
 * activaria el 31 de agosto por la noche en España.
 */
export function localDay(date: Date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/**
 * Que entrada del calendario toca aplicar hoy, o null si ninguna.
 *
 * `schedule` va del id de la rutina a la fecha (yyyy-mm-dd local) en la que esa
 * rutina pasa a ser la activa. Dos decisiones dan toda la semantica:
 *
 * - **Vale la mas reciente ya vencida**, no la de hoy exacto. Si el bloque
 *   empezaba el 1 y no se abre la app hasta el 5, el 5 entra igual. Y con
 *   septiembre y octubre programados, quien vuelva en noviembre entra en el de
 *   octubre, no en el de septiembre.
 * - **Cada entrada se aplica una sola vez** (`lastApplied`). Sin esa marca,
 *   cambiar de rutina a mano el dia 2 no serviria de nada: el arranque
 *   siguiente volveria a imponer la programada.
 */
export function dueScheduleEntry(
  schedule: Record<string, string>,
  today: string,
  lastApplied: string | null,
): { routineId: string; date: string } | null {
  let best: { routineId: string; date: string } | null = null;

  for (const [routineId, date] of Object.entries(schedule)) {
    if (date > today) continue;
    if (lastApplied !== null && date <= lastApplied) continue;
    // El desempate por id evita que dos rutinas con la misma fecha dependan
    // del orden de las claves del objeto.
    if (!best || date > best.date || (date === best.date && routineId < best.routineId)) {
      best = { routineId, date };
    }
  }

  return best;
}

/** Semana sin reorganizar: cada dia muestra lo suyo. */
export function identityWeekMap(): Record<DayOfWeek, DayOfWeek | null> {
  return {
    monday: 'monday',
    tuesday: 'tuesday',
    wednesday: 'wednesday',
    thursday: 'thursday',
    friday: 'friday',
    saturday: 'saturday',
    sunday: 'sunday',
  };
}

/**
 * Mueve el entreno de `from` a `to` arrastrando la semana.
 *
 * El dia de origen queda libre. Si el destino ya tenia entreno, ese entreno y
 * los que le siguen bajan un puesto hasta el primer dia libre — no se apilan
 * dos sesiones en el mismo dia ni se pierde ninguna. Los dias que quedan entre
 * medias no se tocan.
 *
 * Devuelve el mismo objeto que recibio cuando el movimiento no tiene sentido
 * (mover un descanso, o una semana tan llena que no cabe el arrastre): quien
 * llama lo usa para no marcar la semana como reorganizada sin motivo.
 */
export function shiftWeekPlan(
  map: Record<DayOfWeek, DayOfWeek | null>,
  hasWork: (day: DayOfWeek | null) => boolean,
  from: DayOfWeek,
  to: DayOfWeek,
): Record<DayOfWeek, DayOfWeek | null> {
  if (from === to) return map;

  const moved = map[from];
  if (!hasWork(moved)) return map;

  const next = { ...map };
  next[from] = null;

  if (hasWork(next[to])) {
    const target = DAY_ORDER.indexOf(to);
    let gap = -1;

    // Primer dia libre a partir del destino: ahi termina el arrastre.
    for (let i = target; i < DAY_ORDER.length; i++) {
      if (!hasWork(next[DAY_ORDER[i]])) {
        gap = i;
        break;
      }
    }

    if (gap !== -1) {
      for (let i = gap; i > target; i--) next[DAY_ORDER[i]] = next[DAY_ORDER[i - 1]];
    } else {
      // Sin hueco hasta el domingo, se arrastra hacia el principio de la semana.
      for (let i = target; i >= 0; i--) {
        if (!hasWork(next[DAY_ORDER[i]])) {
          gap = i;
          break;
        }
      }
      if (gap === -1) return map;
      for (let i = gap; i < target; i++) next[DAY_ORDER[i]] = next[DAY_ORDER[i + 1]];
    }
  }

  next[to] = moved;
  return next;
}

interface RoutineStore {
  routines: Routine[];
  activeRoutineId: string | null;
  /**
   * Cuándo se eligió `activeRoutineId` en ESTE dispositivo. Es lo que permite
   * decidir quién manda al sincronizar: sin una marca de tiempo, «la local
   * siempre gana» dejaba a cada teléfono clavado en su propia selección y
   * cambiar de rutina en un dispositivo no llegaba nunca al otro.
   */
  activeRoutineUpdatedAt: string | null;
  /** Reorganizacion de la semana en curso; null = la rutina va tal cual. */
  weekPlan: WeekPlan | null;
  weekPlanUpdatedAt: string | null;
  /**
   * Calendario de rutinas: id de rutina -> fecha (yyyy-mm-dd local) en la que
   * pasa a ser la activa.
   *
   * Vive fuera de `Routine` a proposito. La fecha es del plan de quien entrena,
   * no de la rutina: compartir o importar una rutina no debe arrastrar el
   * calendario de nadie. Ademas asi tambien se puede programar una plantilla,
   * que no se persiste como rutina propia.
   */
  schedule: Record<string, string>;
  scheduleUpdatedAt: string | null;
  /** Fecha de la ultima entrada ya aplicada. Ver `dueScheduleEntry`. */
  lastScheduledApply: string | null;
  lastBackup: string | null;
  loading: boolean;
  /**
   * Si ya se ha leído la BD en esta sesión. No se persiste a propósito: cada
   * arranque tiene que volver a leer antes de poder escribir (ver `saveToDb`).
   */
  hydrated: boolean;

  setRoutines: (routines: Routine[]) => void;
  addRoutine: (routine: Routine) => void;
  updateRoutine: (id: string, routine: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  cloneRoutine: (sourceId: string, name?: string) => string | null;
  setActiveRoutine: (id: string | null) => void;

  /** Programa `routineId` para activarse el dia `date` (yyyy-mm-dd local). */
  scheduleRoutine: (routineId: string, date: string) => void;
  unscheduleRoutine: (routineId: string) => void;
  /**
   * Aplica el calendario si toca y devuelve la rutina que se ha activado, o
   * null. Idempotente: la segunda llamada del mismo dia no hace nada.
   */
  applyDueSchedule: () => Routine | null;
  /** Fecha programada de una rutina, o null. */
  getScheduledDate: (routineId: string) => string | null;

  moveRoutineDay: (from: DayOfWeek, to: DayOfWeek) => void;
  resetWeekPlan: () => void;

  getActiveRoutine: () => Routine | null;
  /** Plan de esta semana, o null si no hay o si el guardado es de otra semana. */
  getWeekPlan: () => WeekPlan | null;
  /** Que toca el dia `day` de esta semana, ya con la reorganizacion aplicada. */
  getRoutineDay: (day: DayOfWeek) => DayRoutine | null;
  /** Dia de la rutina cuyo contenido se ve en `day` (donde hay que editar). */
  getSourceDay: (day: DayOfWeek) => DayOfWeek | null;
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
  {
    id: 'franvi',
    // El id se queda en 'franvi' a propósito: es la clave con la que las rutinas
    // ya clonadas se emparejan con la plantilla. Cambiarlo convertiría en
    // huérfanas las copias que la gente tenga guardadas.
    name: 'Pivote — 5 días',
    description:
      'Cinco días pensados para un pivote: fuerza en los básicos, un día entero de bisagra de cadera y olímpicos programados a 2 repeticiones. Deja el fin de semana libre para partido.',
    isCustom: false,
    createdAt: new Date().toISOString(),
    days: {
      // El día de bisagra va suelto a mitad de semana en vez de repartido como
      // accesorio. Es el patrón que sostiene el bloqueo y el contacto del
      // pivote, y como accesorio al final de una sesión nunca recibe carga real.
      monday: {
        name: 'Inferior — Fuerza',
        exercises: [
          {
            name: 'Sentadilla',
            sets: 4,
            reps: '5',
            notes: 'Empieza al 72% y sube un 2,5% por semana. Deja 2 repeticiones en recámara.',
          },
          {
            name: 'Sentadilla Parcial',
            sets: 3,
            reps: '3',
            notes:
              '90-100%+ del 1RM. Solo el cuarto superior del recorrido. Sobrecarga el SNC con cargas que no puedes manejar en completa.',
          },
          {
            name: 'Sentadilla búlgara',
            sets: 3,
            reps: '8 por pierna',
            notes: 'Una pierna cada vez: el balonmano se juega a una pierna.',
          },
          {
            name: 'Gemelos de pie',
            sets: 4,
            reps: '12',
            notes: 'El tobillo aguanta cada frenada y cada apoyo del salto.',
          },
          {
            name: 'Press Pallof',
            sets: 3,
            reps: '12 por lado',
            notes: 'Antirrotación: el core sujeta el lanzamiento, no lo genera.',
          },
        ],
      },
      tuesday: {
        name: 'Superior — Empuje y hombro sano',
        exercises: [
          { name: 'Press banca', sets: 4, reps: '5', notes: 'Misma progresión que la sentadilla.' },
          { name: 'Press militar', sets: 4, reps: '6' },
          {
            name: 'Fondos en paralelas',
            sets: 3,
            reps: '8',
            notes: 'Con lastre cuando salgan limpias. Para si el hombro avisa.',
          },
          {
            name: 'Rotación externa con goma',
            sets: 3,
            reps: '15 por brazo',
            notes: 'Manguito rotador. Poco peso, control total.',
          },
        ],
      },
      wednesday: {
        name: 'Bisagra — Cadena posterior',
        exercises: [
          {
            name: 'Peso muerto',
            sets: 4,
            reps: '5',
            notes:
              'Deja 3 repeticiones en recámara. Si vienes de no entrenar el patrón, las dos primeras semanas haz peso muerto rumano ligero y céntrate en la técnica.',
          },
          { name: 'Hip thrust', sets: 3, reps: '10' },
          { name: 'Curl femoral tumbado', sets: 3, reps: '12' },
          { name: 'Rueda abdominal', sets: 3, reps: '8' },
        ],
      },
      thursday: {
        name: 'Tirón + hombro',
        exercises: [
          { name: 'Dominadas', sets: 5, reps: '5', notes: 'Con lastre cuando salgan limpias.' },
          { name: 'Remo con barra', sets: 4, reps: '6' },
          {
            name: 'Face pull',
            sets: 3,
            reps: '15',
            notes: 'Innegociable: el hombro que lanza necesita el trabajo de detrás.',
          },
          {
            name: 'Curl bíceps',
            sets: 3,
            reps: '10',
            notes: 'Único día de bíceps de la semana. Más no aporta ni fuerza ni lanzamiento.',
          },
        ],
      },
      friday: {
        name: 'Potencia y salto',
        exercises: [
          {
            name: 'Power Clean',
            sets: 5,
            reps: '2',
            notes:
              'Máximo 3 repeticiones por serie. Por encima de ahí deja de entrenar potencia: la barra se frena y solo queda el riesgo.',
          },
          {
            name: 'Lanzamiento de balón medicinal',
            sets: 4,
            reps: '5 sobre cabeza + 5 por lado',
            notes: 'Pies plantados, máxima intención.',
          },
          {
            name: 'Salto al cajón',
            sets: 4,
            reps: '5',
            notes:
              'Baja andando. Si la rodilla molesta con el impacto, empieza solo con aterrizajes desde 20 cm aguantando 2 segundos.',
          },
          { name: 'Leñador en polea', sets: 3, reps: '10 por lado' },
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
      activeRoutineUpdatedAt: null,
      weekPlan: null,
      weekPlanUpdatedAt: null,
      schedule: {},
      scheduleUpdatedAt: null,
      lastScheduledApply: null,
      lastBackup: null,
      loading: false,
      hydrated: false,

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
        const { routines, activeRoutineId, activeRoutineUpdatedAt, schedule, scheduleUpdatedAt } =
          get();
        const clearsActive = activeRoutineId === id;
        // Una fecha que apunta a una rutina borrada no activaria nada y ademas
        // taparia a la entrada anterior del calendario.
        const wasScheduled = id in schedule;
        const nextSchedule = { ...schedule };
        delete nextSchedule[id];
        set({
          routines: routines.filter((r) => r.id !== id),
          schedule: nextSchedule,
          scheduleUpdatedAt: wasScheduled ? new Date().toISOString() : scheduleUpdatedAt,
          activeRoutineId: clearsActive ? null : activeRoutineId,
          // Quedarse sin rutina activa también es una decisión de este
          // dispositivo: se sella para que no la revierta un remoto anterior.
          activeRoutineUpdatedAt: clearsActive ? new Date().toISOString() : activeRoutineUpdatedAt,
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

      setActiveRoutine: (id) =>
        set({ activeRoutineId: id, activeRoutineUpdatedAt: new Date().toISOString() }),

      scheduleRoutine: (routineId, date) =>
        set((state) => ({
          schedule: { ...state.schedule, [routineId]: date },
          scheduleUpdatedAt: new Date().toISOString(),
        })),

      unscheduleRoutine: (routineId) =>
        set((state) => {
          if (!(routineId in state.schedule)) return state;
          const next = { ...state.schedule };
          delete next[routineId];
          return { ...state, schedule: next, scheduleUpdatedAt: new Date().toISOString() };
        }),

      getScheduledDate: (routineId) => get().schedule[routineId] ?? null,

      applyDueSchedule: () => {
        const { schedule, lastScheduledApply, routines, activeRoutineId } = get();
        const due = dueScheduleEntry(schedule, localDay(), lastScheduledApply);
        if (!due) return null;

        // Se sella la entrada aunque no se llegue a activar nada: si no, una
        // fecha vencida que no se puede aplicar se reintentaria en cada
        // arranque, y la rutina programada volveria a imponerse despues de que
        // el usuario cambiase a mano.
        set({ lastScheduledApply: due.date, scheduleUpdatedAt: new Date().toISOString() });

        const routine = routines.find((r) => r.id === due.routineId) ?? null;
        if (!routine || routine.id === activeRoutineId) return null;

        get().setActiveRoutine(routine.id);
        return routine;
      },

      getActiveRoutine: () => {
        const { routines, activeRoutineId } = get();
        if (!activeRoutineId) return null;
        return routines.find((r) => r.id === activeRoutineId) || null;
      },

      moveRoutineDay: (from, to) => {
        const routine = get().getActiveRoutine();
        if (!routine) return;

        const current = get().getWeekPlan()?.map ?? identityWeekMap();
        const hasWork = (day: DayOfWeek | null) =>
          day !== null && (routine.days[day]?.exercises.length ?? 0) > 0;

        const map = shiftWeekPlan(current, hasWork, from, to);
        // shiftWeekPlan devuelve el mapa original cuando no hay nada que mover:
        // sin esta salida, arrastrar un descanso dejaria la semana marcada como
        // reorganizada sin haber cambiado nada.
        if (map === current) return;

        set({
          weekPlan: { weekStart: weekStartOf(new Date()), map },
          weekPlanUpdatedAt: new Date().toISOString(),
        });
      },

      resetWeekPlan: () => {
        if (!get().weekPlan) return;
        set({ weekPlan: null, weekPlanUpdatedAt: new Date().toISOString() });
      },

      getWeekPlan: () => {
        const plan = get().weekPlan;
        if (!plan) return null;
        // Caduca sola: un plan de la semana pasada no se aplica ni se borra
        // aqui (un getter no deberia escribir); lo limpia el primer movimiento
        // o el guardado.
        return plan.weekStart === weekStartOf(new Date()) ? plan : null;
      },

      getSourceDay: (day) => {
        const plan = get().getWeekPlan();
        return plan ? plan.map[day] : day;
      },

      getRoutineDay: (day) => {
        const activeRoutine = get().getActiveRoutine();
        if (!activeRoutine) return null;

        const source = get().getSourceDay(day);
        if (!source) return null;

        return activeRoutine.days[source] || null;
      },

      getTodayRoutine: () => get().getRoutineDay(get().getDayName()),

      getDayName: () => {
        const dayIndex = new Date().getDay();
        return dayNames[dayIndex];
      },

      saveToDb: async (userId: string) => {
        // Nunca escribir sin haber leído antes.
        //
        // El respaldo se dispara desde sitios que no cargan rutinas: la pantalla
        // de inicio (`checkAndBackup`) y el cierre de sesión (`sessionTasks`).
        // En un dispositivo recién instalado el estado local son solo las
        // plantillas, así que ese primer respaldo subía una lista vacía y
        // borraba las rutinas que el usuario tenía guardadas en la nube.
        // Leer primero deja que `loadFromDb` restaure lo remoto y que el
        // guardado suba la mezcla, no el estado en blanco.
        if (!get().hydrated) await get().loadFromDb(userId);

        const doSave = async (): Promise<boolean> => {
          const {
            routines,
            activeRoutineId,
            activeRoutineUpdatedAt,
            weekPlanUpdatedAt,
            schedule,
            scheduleUpdatedAt,
            lastScheduledApply,
            lastBackup,
          } = get();
          // Solo viaja el plan si sigue siendo el de esta semana: subir uno
          // caducado lo reviviria en el resto de dispositivos.
          const weekPlan = get().getWeekPlan();

          const customRoutines = routines.filter((r) => r.isCustom);

          // La tabla real tiene una sola columna `routine` (jsonb): la usamos como
          // contenedor de las rutinas custom + estado.
          const { error } = await supabase.from('user_routines').upsert(
            {
              user_id: userId,
              routine: {
                routines: customRoutines,
                activeRoutineId,
                activeRoutineUpdatedAt,
                weekPlan,
                weekPlanUpdatedAt,
                schedule,
                scheduleUpdatedAt,
                lastScheduledApply,
                lastBackup,
              },
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
          activeRoutineUpdatedAt?: string | null;
          weekPlan?: WeekPlan | null;
          weekPlanUpdatedAt?: string | null;
          schedule?: Record<string, string> | null;
          scheduleUpdatedAt?: string | null;
          lastScheduledApply?: string | null;
          lastBackup?: string | null;
        } | null;

        if (!error && container) {
          const remoteCustom = ((container.routines || []) as Routine[]).filter(
            (cr) => !PREDEFINED_ROUTINES.some((pr) => pr.id === cr.id),
          );

          // Merge con la BD como fuente de verdad para rutinas existentes:
          // - Las rutinas remotas sobreescriben las locales cuando coincide el id
          //   (permite editar desde otro dispositivo o desde herramientas externas).
          // - Las rutinas locales que aún no están en la BD se conservan para no
          //   perder cambios pendientes de subir (offline / saveToDb fallido).
          const localCustom = get().routines.filter((r) => r.isCustom);
          const remoteIds = new Set(remoteCustom.map((r) => r.id));
          const localOnlyCustom = localCustom.filter((r) => !remoteIds.has(r.id));
          const mergedRoutines = [...PREDEFINED_ROUTINES, ...remoteCustom, ...localOnlyCustom];

          const hasUnsyncedLocal = localOnlyCustom.length > 0;

          // `hydrated` se marca aquí, antes del re-subido de abajo: si no, ese
          // `saveToDb` volvería a entrar en `loadFromDb` y se llamarían en bucle.
          // Qué rutina queda seleccionada: gana la elección más reciente, venga
          // del dispositivo que venga. Antes la local ganaba siempre que no
          // fuese nula, así que cambiar de rutina activa en el móvil nunca
          // llegaba al portátil ni al revés.
          //
          // Las marcas son ISO-8601, que ordena igual como texto que como
          // fecha. Si el remoto no trae marca (datos escritos por una versión
          // anterior) se conserva el comportamiento de siempre: manda la local.
          const localStamp = get().activeRoutineUpdatedAt;
          const remoteStamp = container.activeRoutineUpdatedAt ?? null;
          const remoteIsNewer =
            remoteStamp !== null && (localStamp === null || remoteStamp > localStamp);
          // Una selección remota que apunte a una rutina que aquí no existe
          // (borrada en este dispositivo) dejaría la pantalla en blanco.
          const remoteActiveExists =
            container.activeRoutineId != null &&
            mergedRoutines.some((r) => r.id === container.activeRoutineId);
          const takeRemoteActive = remoteIsNewer && remoteActiveExists;

          // El plan de la semana se sincroniza con la misma regla que la rutina
          // activa (gana la marca mas reciente) y con un filtro extra: solo se
          // adopta si es de la semana en curso. Reorganizar en el movil el
          // martes y abrir la web el miercoles tiene que enseñar lo mismo.
          const localPlanStamp = get().weekPlanUpdatedAt;
          const remotePlanStamp = container.weekPlanUpdatedAt ?? null;
          const remotePlan = container.weekPlan ?? null;
          const remotePlanIsCurrent =
            remotePlan != null && remotePlan.weekStart === weekStartOf(new Date());
          const takeRemotePlan =
            remotePlanStamp !== null &&
            (localPlanStamp === null || remotePlanStamp > localPlanStamp);

          // El calendario se sincroniza con la misma regla que la rutina
          // activa: gana la marca mas reciente. `lastScheduledApply` es la
          // excepcion y se queda con la fecha mayor de las dos: si el movil ya
          // aplico el bloque de septiembre, el portatil no tiene que volver a
          // imponerlo cuando el usuario ya haya cambiado de rutina a mano.
          const localSchedStamp = get().scheduleUpdatedAt;
          const remoteSchedStamp = container.scheduleUpdatedAt ?? null;
          const takeRemoteSchedule =
            remoteSchedStamp !== null &&
            (localSchedStamp === null || remoteSchedStamp > localSchedStamp);
          const localApplied = get().lastScheduledApply;
          const remoteApplied = container.lastScheduledApply ?? null;

          set({
            routines: mergedRoutines,
            schedule: takeRemoteSchedule ? (container.schedule ?? {}) : get().schedule,
            scheduleUpdatedAt: takeRemoteSchedule ? remoteSchedStamp : localSchedStamp,
            lastScheduledApply:
              localApplied === null || (remoteApplied !== null && remoteApplied > localApplied)
                ? remoteApplied
                : localApplied,
            weekPlan: takeRemotePlan
              ? remotePlanIsCurrent
                ? remotePlan
                : null
              : (get().getWeekPlan() ?? null),
            weekPlanUpdatedAt: takeRemotePlan ? remotePlanStamp : localPlanStamp,
            activeRoutineId: takeRemoteActive
              ? (container.activeRoutineId ?? null)
              : (get().activeRoutineId ?? container.activeRoutineId ?? null),
            // Adoptar también la marca evita que la siguiente carga vuelva a
            // considerar «nueva» la misma selección remota una y otra vez.
            activeRoutineUpdatedAt: takeRemoteActive ? remoteStamp : localStamp,
            lastBackup: container.lastBackup ?? get().lastBackup ?? null,
            loading: false,
            hydrated: true,
          });

          // Re-sube las rutinas locales que la BD aún no conoce (guardado
          // previo fallido u offline).
          if (hasUnsyncedLocal) void get().saveToDb(userId);
        } else {
          // Sin fila todavía (usuario nuevo) también cuenta como leído: no hay
          // nada remoto que se pueda pisar. Solo un error de red deja
          // `hydrated` en false para que el siguiente respaldo reintente.
          set({ loading: false, hydrated: !error ? true : get().hydrated });
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
        activeRoutineUpdatedAt: state.activeRoutineUpdatedAt,
        weekPlan: state.weekPlan,
        weekPlanUpdatedAt: state.weekPlanUpdatedAt,
        schedule: state.schedule,
        scheduleUpdatedAt: state.scheduleUpdatedAt,
        lastScheduledApply: state.lastScheduledApply,
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
