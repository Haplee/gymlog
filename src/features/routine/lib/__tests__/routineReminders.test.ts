// @vitest-environment jsdom
/**
 * Resolución de los recordatorios de rutina contra la fecha futura en la que
 * sonarán la alarma, no contra «ahora».
 *
 * Los tres casos que motivaron el arreglo: el calendario de rutinas cambiaba la
 * rutina activa y el recordatorio seguía nombrando la antigua; el plan de la
 * semana reorganizada se aplicaba también a semanas entrantes (caduca solo el
 * lunes); y un día de descanso generaba recordatorio con el día vacío.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  DayOfWeek,
  DayRoutine,
  Routine,
  WeekPlan,
} from '@features/routine/stores/routineStore';
import { useRoutineStore, weekStartOf } from '@features/routine/stores/routineStore';
import {
  getRoutineReminderDays,
  nextWeekdayDate,
  reminderDayRoutine,
  type ReminderContext,
} from '../routineReminders';

const VACIO: DayRoutine = { name: 'Descanso', exercises: [] };
const PUSH: DayRoutine = { name: 'Push', exercises: [{ name: 'Press banca' }] };
const LEGS: DayRoutine = { name: 'Pierna', exercises: [{ name: 'Sentadilla' }] };

function dias(d: Partial<Record<DayOfWeek, DayRoutine>>): Record<DayOfWeek, DayRoutine> {
  return {
    monday: VACIO,
    tuesday: VACIO,
    wednesday: VACIO,
    thursday: VACIO,
    friday: VACIO,
    saturday: VACIO,
    sunday: VACIO,
    ...d,
  };
}

function rutina(id: string, name: string, days: Partial<Record<DayOfWeek, DayRoutine>>): Routine {
  return {
    id,
    name,
    description: '',
    days: dias(days),
    isCustom: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const PUSH_RUTINA = rutina('r-push', 'Push A', { monday: PUSH, wednesday: PUSH });
const LEGS_RUTINA = rutina('r-legs', 'Pierna B', { tuesday: LEGS, friday: LEGS });

function ctx(overrides: Partial<ReminderContext> = {}): ReminderContext {
  return {
    activeRoutineId: 'r-push',
    routines: [PUSH_RUTINA, LEGS_RUTINA],
    schedule: {},
    lastScheduledApply: null,
    weekPlan: null,
    ...overrides,
  };
}

describe('nextWeekdayDate', () => {
  // 2026-10-19 es lunes (getDay() === 1).
  const LUNES = new Date(2026, 9, 19);

  it('si hoy es el día, devuelve hoy', () => {
    expect(nextWeekdayDate(LUNES, 1)).toEqual(new Date(2026, 9, 19));
  });

  it('devuelve el próximo día de la semana contando hacia delante', () => {
    // Del lunes al viernes: 4 días.
    expect(nextWeekdayDate(LUNES, 5)).toEqual(new Date(2026, 9, 23));
  });

  it('da la vuelta a la semana: del lunes al domingo es dentro de 6 días', () => {
    expect(nextWeekdayDate(LUNES, 0)).toEqual(new Date(2026, 9, 25));
  });

  it('la fecha devuelta mantiene año, mes y día locales', () => {
    const d = nextWeekdayDate(LUNES, 0);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(25);
  });
});

describe('reminderDayRoutine', () => {
  const LUNES = new Date(2026, 9, 19);

  it('con la rutina activa devuelve el día que toca', () => {
    // Lunes → Push en la rutina activa.
    expect(reminderDayRoutine(ctx(), 'monday', LUNES)?.name).toBe('Push');
  });

  it('un día sin ejercicios devuelve el día (descanso), no null', () => {
    // El martes no entrena en Push A: `days` existe pero está vacío.
    const day = reminderDayRoutine(ctx(), 'tuesday', LUNES);
    expect(day).not.toBeNull();
    expect(day?.exercises).toHaveLength(0);
  });

  it('el calendario futuro manda sobre la rutina activa', () => {
    // Un bloque programa Pierna B el 2026-10-20 (martes). La resolución del
    // martes 20 ya tiene que nombrar Pierna, no la activa (Push).
    const c = ctx({ schedule: { 'r-legs': '2026-10-20' } });
    const day = reminderDayRoutine(c, 'tuesday', new Date(2026, 9, 20));
    expect(day?.name).toBe('Pierna');
  });

  it('una entrada ya aplicada no vuelve a mandar', () => {
    // El bloque era del 18, ya aplicado: el martes 20 sigue con la activa,
    // cuyo martes es de descanso.
    const c = ctx({
      schedule: { 'r-legs': '2026-10-18' },
      lastScheduledApply: '2026-10-18',
    });
    const day = reminderDayRoutine(c, 'tuesday', new Date(2026, 9, 20));
    expect(day?.name).toBe('Descanso');
  });

  it('una entrada programada a futuro NO se aplica todavía', () => {
    // Bloque del 25 (domingo). El lunes 19 aún no ha llegado: manda la activa.
    const c = ctx({ schedule: { 'r-legs': '2026-10-25' } });
    const day = reminderDayRoutine(c, 'monday', LUNES);
    expect(day?.name).toBe('Push');
  });

  it('el plan de la semana solo vale en su semana', () => {
    // Plan de la semana del lunes 19: el entreno del lunes se pasa al viernes.
    const weekPlan: WeekPlan = {
      weekStart: '2026-10-19',
      map: {
        monday: null,
        tuesday: 'tuesday',
        wednesday: 'wednesday',
        thursday: 'thursday',
        friday: 'monday',
        saturday: 'saturday',
        sunday: 'sunday',
      },
    };
    const c = ctx({ weekPlan });
    // En su semana el viernes muestra el contenido del lunes (Push).
    expect(reminderDayRoutine(c, 'friday', new Date(2026, 9, 23))?.name).toBe('Push');
    // Semana siguiente (viernes 30): el plan caducó, vuelve el orden base
    // (viernes de descanso en Push A).
    expect(reminderDayRoutine(c, 'friday', new Date(2026, 9, 30))?.name).toBe('Descanso');
  });

  it('un día liberado en el plan (null) devuelve null', () => {
    // El lunes quedó libre al mover el entreno al viernes: la pantalla muestra
    // descanso (`getRoutineDay` → `getSourceDay` devuelve null), así que el
    // recordatorio no puede nombrar el entreno base de ese día.
    const weekPlan: WeekPlan = {
      weekStart: '2026-10-19',
      map: {
        monday: null,
        tuesday: 'tuesday',
        wednesday: 'wednesday',
        thursday: 'thursday',
        friday: 'friday',
        saturday: 'saturday',
        sunday: 'sunday',
      },
    };
    expect(reminderDayRoutine(ctx({ weekPlan }), 'monday', LUNES)).toBeNull();
  });

  it('sin rutina activa ni programada no hay recordatorio', () => {
    expect(reminderDayRoutine(ctx({ activeRoutineId: null }), 'monday', LUNES)).toBeNull();
  });

  it('una rutina programada que ya no existe cae a la activa', () => {
    const c = ctx({ schedule: { 'r-borrada': '2026-10-19' } });
    expect(reminderDayRoutine(c, 'monday', LUNES)?.name).toBe('Push');
  });
});

/* ----------------------- puente store → recordatorios --------------------- */

/**
 * `getRoutineReminderDays` lee el store de verdad y decide qué días tienen
 * alarma. La resolución pura está probada arriba; aquí se comprueba el cableado
 * con el store real: que el descanso no genere aviso, que la semana
 * reorganizada solo pese en su semana y que un plan caducado no se aplique.
 *
 * La clave es que el método resuelve la PRÓXIMA ocurrencia de cada día, así que
 * un `weekPlan` de la semana vigente solo toca a los días que aún faltan esta
 * semana (incluido hoy, cuya próxima ocurrencia es hoy mismo).
 */
describe('getRoutineReminderDays (con el store)', () => {
  const JS_TO_DAY: DayOfWeek[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const hoyDia = (): DayOfWeek => JS_TO_DAY[new Date().getDay()];
  /** Weekday Capacitor de hoy (1=domingo … 7=sábado), mismo criterio que el módulo. */
  const hoyWeekday = (): number => new Date().getDay() + 1;

  const mapaIdentidad = (): Record<DayOfWeek, DayOfWeek | null> => ({
    monday: 'monday',
    tuesday: 'tuesday',
    wednesday: 'wednesday',
    thursday: 'thursday',
    friday: 'friday',
    saturday: 'saturday',
    sunday: 'sunday',
  });

  const PUSH_SOLO = rutina('r-push', 'Push A', { monday: PUSH, wednesday: PUSH });
  const PUSH_TODOS = rutina('r-todos', 'Full', {
    monday: PUSH,
    tuesday: PUSH,
    wednesday: PUSH,
    thursday: PUSH,
    friday: PUSH,
    saturday: PUSH,
    sunday: PUSH,
  });

  /** Fija la rutina activa y limpia calendario/plan: estado neutro conocido. */
  function poner(routines: Routine[], weekPlan: WeekPlan | null = null) {
    useRoutineStore.setState({
      routines,
      activeRoutineId: routines[0]?.id ?? null,
      schedule: {},
      lastScheduledApply: null,
      weekPlan,
    });
  }

  beforeEach(() => {
    poner([]);
  });

  it('sin rutina activa no hay ningún día', () => {
    poner([]);
    expect(getRoutineReminderDays()).toEqual([]);
  });

  it('solo lista los días con ejercicios: el descanso no avisa', () => {
    poner([PUSH_SOLO]);
    const days = getRoutineReminderDays();
    // Lunes (2) y miércoles (4) entrenan; el resto de la semana está vacío.
    expect(days.map((d) => d.weekday).sort((a, b) => a - b)).toEqual([2, 4]);
    // El nombre que sale en la alarma es el del día (DayRoutine), no el de la rutina.
    expect(days.every((d) => d.routineName === 'Push')).toBe(true);
  });

  it('la semana reorganizada pesa en su semana: el día movido sí avisa', () => {
    // Solo el lunes entrena. El plan vigente muestra ese entreno también hoy
    // (mapea hoy → lunes); como la próxima ocurrencia de hoy cae en la semana
    // vigente, el plan manda y hoy debe avisar.
    poner([PUSH_SOLO], {
      weekStart: weekStartOf(new Date()),
      map: { ...mapaIdentidad(), [hoyDia()]: 'monday' },
    });
    expect(getRoutineReminderDays().some((d) => d.weekday === hoyWeekday())).toBe(true);
  });

  it('un día liberado en la semana vigente no avisa', () => {
    // La rutina entrena todos los días; el plan vigente libera hoy. Hoy no
    // debe avisar (la pantalla enseñaría descanso).
    poner([PUSH_TODOS], {
      weekStart: weekStartOf(new Date()),
      map: { ...mapaIdentidad(), [hoyDia()]: null },
    });
    expect(getRoutineReminderDays().some((d) => d.weekday === hoyWeekday())).toBe(false);
  });

  it('un plan de la semana pasada no se aplica: manda el orden base', () => {
    // Solo lunes y miércoles entrenan. Un plan caducado que intentara mover hoy
    // se ignora: el resultado es el orden base (lunes y miércoles).
    poner([PUSH_SOLO], {
      weekStart: '2020-01-06', // un lunes lejano, ya caducado
      map: { ...mapaIdentidad(), [hoyDia()]: 'monday' },
    });
    expect(getRoutineReminderDays()).toEqual([
      { weekday: 2, routineName: 'Push' },
      { weekday: 4, routineName: 'Push' },
    ]);
  });
});
