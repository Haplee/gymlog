// @vitest-environment jsdom
// El store arrastra el cliente de Supabase, que toca `window.localStorage` al
// importarse; sin DOM el módulo ni siquiera carga. En CI no hay variables de
// entorno, así que `createClient('', '')` reventaría al importar: se sustituye
// el cliente real por uno vacío, igual que en los tests hermanos.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@shared/lib/supabase', () => ({ supabase: { from: vi.fn() } }));
import { supabase } from '@shared/lib/supabase';
import {
  useRoutineStore,
  PREDEFINED_ROUTINES,
  shiftWeekPlan,
  identityWeekMap,
  weekStartOf,
  dueScheduleEntry,
  localDay,
  type DayOfWeek,
  type Routine,
} from '../routineStore';
import { planModeOf, planDurationOf } from '../../utils/planTarget';

const mockFrom = vi.mocked(supabase.from);

/**
 * Simula la lectura de `user_routines` que hace `loadFromDb`.
 *
 * Incluye `upsert` porque `loadFromDb` re-sube por su cuenta las rutinas
 * locales que la BD aún no conoce: sin él, esos tests dejan un rechazo de
 * promesa sin capturar que no rompe el runner pero ensucia la salida.
 */
function mockRemoteContainer(container: unknown) {
  mockFrom.mockImplementation(
    () =>
      ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { routine: container }, error: null }) }),
        }),
        upsert: async () => ({ error: null }),
      }) as unknown as ReturnType<typeof supabase.from>,
  );
}

const DAYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** Rutina propia mínima, como la que deja el usuario al crear una suya. */
function customRoutine(id: string): Routine {
  return {
    id,
    name: `Mía ${id}`,
    description: '',
    isCustom: true,
    createdAt: new Date().toISOString(),
    days: {
      monday: { name: 'Descanso', exercises: [] },
      tuesday: { name: 'Descanso', exercises: [] },
      wednesday: { name: 'Descanso', exercises: [] },
      thursday: { name: 'Descanso', exercises: [] },
      friday: { name: 'Descanso', exercises: [] },
      saturday: { name: 'Descanso', exercises: [] },
      sunday: { name: 'Descanso', exercises: [] },
    },
  };
}

/**
 * Una rutina propia tal y como la deja serializada la version **actual** de la
 * app en localStorage y en `user_routines`: sin `mode`, sin `perSide` y sin
 * `durationSeconds`, porque esos campos no existian cuando se guardo.
 *
 * Es la unica prueba que importa de la compatibilidad de la fase 2: si algun
 * dia la lectura empieza a exigir los campos nuevos, esto se cae aqui y no en
 * el movil de alguien que abre la app y ve su rutina en blanco.
 */
const RUTINA_SERIALIZADA_V1 = JSON.stringify({
  id: 'mia-vieja',
  name: 'Torso pierna',
  description: '',
  isCustom: true,
  createdAt: '2026-01-15T10:00:00.000Z',
  days: {
    monday: {
      name: 'Torso',
      exercises: [
        { name: 'Press banca', sets: 4, reps: '8-10' },
        { name: 'Remo con barra', sets: 4, reps: '8-10', notes: 'Espalda neutra' },
      ],
    },
    tuesday: { name: 'Descanso', exercises: [] },
    wednesday: { name: 'Pierna', exercises: [{ name: 'Sentadilla', sets: 5, reps: '5' }] },
    thursday: { name: 'Descanso', exercises: [] },
    friday: { name: 'Descanso', exercises: [] },
    saturday: { name: 'Descanso', exercises: [] },
    sunday: { name: 'Descanso', exercises: [] },
  },
});

describe('rutinas guardadas antes de los modos de registro', () => {
  it('se leen igual que hoy: sin modo es modo repeticiones', () => {
    const rutina = JSON.parse(RUTINA_SERIALIZADA_V1) as Routine;
    const ejercicios = rutina.days.monday.exercises;

    expect(ejercicios).toHaveLength(2);
    for (const ex of ejercicios) {
      expect(ex.mode).toBeUndefined();
      expect(planModeOf(ex)).toBe('reps');
      expect(planDurationOf(ex)).toBeNull();
    }
    expect(ejercicios[0].sets).toBe(4);
    expect(ejercicios[0].reps).toBe('8-10');
    expect(ejercicios[1].notes).toBe('Espalda neutra');
  });

  it('entra en el store por loadFromDb y sale intacta', async () => {
    const rutina = JSON.parse(RUTINA_SERIALIZADA_V1) as Routine;
    mockRemoteContainer({ routines: [rutina], activeRoutineId: rutina.id });

    await useRoutineStore.getState().loadFromDb('u1');

    const guardada = useRoutineStore.getState().routines.find((r) => r.id === 'mia-vieja');
    expect(guardada).toBeDefined();
    expect(guardada?.days.wednesday.exercises[0]).toEqual({
      name: 'Sentadilla',
      sets: 5,
      reps: '5',
    });
  });

  it('las plantillas predefinidas tampoco declaran modo: todas son de reps', () => {
    for (const routine of PREDEFINED_ROUTINES) {
      for (const day of DAYS) {
        for (const ex of routine.days[day].exercises) {
          expect(planModeOf(ex)).toBe('reps');
        }
      }
    }
  });
});

describe('plantillas predefinidas', () => {
  it('todas cubren los siete días de la semana', () => {
    for (const routine of PREDEFINED_ROUTINES) {
      for (const day of DAYS) {
        expect(routine.days[day], `${routine.id} no define ${day}`).toBeDefined();
      }
    }
  });

  it('ningún ejercicio se queda sin series ni repeticiones', () => {
    for (const routine of PREDEFINED_ROUTINES) {
      for (const day of DAYS) {
        for (const ex of routine.days[day].exercises) {
          expect(ex.name.trim(), `${routine.id}/${day}: nombre vacío`).not.toBe('');
          expect(ex.sets, `${routine.id}/${day}/${ex.name}: sin series`).toBeGreaterThan(0);
          expect(ex.reps, `${routine.id}/${day}/${ex.name}: sin reps`).toBeTruthy();
        }
      }
    }
  });

  it('los identificadores no se repiten', () => {
    const ids = PREDEFINED_ROUTINES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('rehidratación del almacenamiento', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * El escenario que motivó el `merge`: alguien que instaló la app hace meses
   * tiene en disco la lista de plantillas de entonces. Sin reinyectarlas, una
   * plantilla añadida después no le llegaría jamás.
   */
  it('devuelve las plantillas actuales aunque el disco traiga una lista vieja', () => {
    const plantillaVieja = { ...PREDEFINED_ROUTINES[0], name: 'Nombre de hace seis meses' };
    const mia = customRoutine('custom-1');

    localStorage.setItem(
      'gymlog-routines',
      JSON.stringify({
        state: { routines: [plantillaVieja, mia], activeRoutineId: 'custom-1', lastBackup: null },
        version: 0,
      }),
    );

    useRoutineStore.persist.rehydrate();
    const { routines, activeRoutineId } = useRoutineStore.getState();

    // Las plantillas salen del código, no del disco.
    for (const p of PREDEFINED_ROUTINES) {
      expect(routines.find((r) => r.id === p.id)?.name).toBe(p.name);
    }
    // Y lo del usuario sigue ahí, incluida su selección.
    expect(routines.find((r) => r.id === 'custom-1')).toBeDefined();
    expect(activeRoutineId).toBe('custom-1');
    // Sin duplicados: la plantilla vieja no se suma a la nueva.
    expect(routines.filter((r) => r.id === PREDEFINED_ROUTINES[0].id)).toHaveLength(1);
  });

  it('conserva la marca de la selección al rehidratar', () => {
    localStorage.setItem(
      'gymlog-routines',
      JSON.stringify({
        state: {
          routines: [customRoutine('custom-1')],
          activeRoutineId: 'custom-1',
          activeRoutineUpdatedAt: '2026-08-01T10:00:00.000Z',
          lastBackup: null,
        },
        version: 0,
      }),
    );

    useRoutineStore.persist.rehydrate();

    expect(useRoutineStore.getState().activeRoutineUpdatedAt).toBe('2026-08-01T10:00:00.000Z');
  });

  it('la rutina de balonmano entrena cuatro días y libera el fin de semana', () => {
    const balonmano = PREDEFINED_ROUTINES.find((r) => r.id === 'balonmano-fuerza');
    if (!balonmano) throw new Error('falta la plantilla balonmano-fuerza');

    const conEjercicios = DAYS.filter((d) => balonmano.days[d].exercises.length > 0);
    expect(conEjercicios).toEqual(['monday', 'tuesday', 'thursday', 'friday']);
    expect(balonmano.days.saturday.exercises).toHaveLength(0);
    expect(balonmano.days.sunday.exercises).toHaveLength(0);
  });
});

/**
 * Qué rutina queda activa al sincronizar dos dispositivos.
 *
 * El fallo original: `activeRoutineId: get().activeRoutineId ?? container.activeRoutineId`
 * dejaba ganar a la local SIEMPRE que no fuese nula, así que un teléfono que ya
 * tenía una rutina elegida se quedaba clavado en ella para siempre. Cambiar de
 * rutina en el portátil no llegaba nunca, y el síntoma era «la rutina nueva no
 * se ha actualizado en el teléfono».
 */
describe('loadFromDb — resolución de la rutina activa', () => {
  const USER = 'user-1';

  beforeEach(() => {
    localStorage.clear();
    mockFrom.mockReset();
    useRoutineStore.setState({
      routines: [...PREDEFINED_ROUTINES, customRoutine('local'), customRoutine('remota')],
      activeRoutineId: null,
      activeRoutineUpdatedAt: null,
      lastBackup: null,
      hydrated: false,
    });
  });

  it('adopta la selección remota cuando es más reciente que la local', async () => {
    useRoutineStore.setState({
      activeRoutineId: 'local',
      activeRoutineUpdatedAt: '2026-08-10T09:00:00.000Z',
    });
    mockRemoteContainer({
      routines: [customRoutine('local'), customRoutine('remota')],
      activeRoutineId: 'remota',
      activeRoutineUpdatedAt: '2026-08-14T12:30:00.000Z',
    });

    await useRoutineStore.getState().loadFromDb(USER);

    expect(useRoutineStore.getState().activeRoutineId).toBe('remota');
    // Y adopta la marca, para no volver a considerarla «nueva» en cada carga.
    expect(useRoutineStore.getState().activeRoutineUpdatedAt).toBe('2026-08-14T12:30:00.000Z');
  });

  it('mantiene la selección local cuando es la más reciente', async () => {
    useRoutineStore.setState({
      activeRoutineId: 'local',
      activeRoutineUpdatedAt: '2026-08-14T18:00:00.000Z',
    });
    mockRemoteContainer({
      routines: [customRoutine('local'), customRoutine('remota')],
      activeRoutineId: 'remota',
      activeRoutineUpdatedAt: '2026-08-14T12:30:00.000Z',
    });

    await useRoutineStore.getState().loadFromDb(USER);

    expect(useRoutineStore.getState().activeRoutineId).toBe('local');
  });

  it('sin marca remota (datos de una versión anterior) manda la local', async () => {
    useRoutineStore.setState({ activeRoutineId: 'local', activeRoutineUpdatedAt: null });
    mockRemoteContainer({
      routines: [customRoutine('local'), customRoutine('remota')],
      activeRoutineId: 'remota',
    });

    await useRoutineStore.getState().loadFromDb(USER);

    expect(useRoutineStore.getState().activeRoutineId).toBe('local');
  });

  it('restaura la remota cuando este dispositivo no tiene ninguna elegida', async () => {
    mockRemoteContainer({
      routines: [customRoutine('remota')],
      activeRoutineId: 'remota',
      activeRoutineUpdatedAt: '2026-08-14T12:30:00.000Z',
    });

    await useRoutineStore.getState().loadFromDb(USER);

    expect(useRoutineStore.getState().activeRoutineId).toBe('remota');
  });

  it('ignora una selección remota que apunta a una rutina que aquí no existe', async () => {
    useRoutineStore.setState({
      activeRoutineId: 'local',
      activeRoutineUpdatedAt: '2026-08-10T09:00:00.000Z',
    });
    mockRemoteContainer({
      routines: [customRoutine('local')],
      activeRoutineId: 'borrada-en-este-dispositivo',
      activeRoutineUpdatedAt: '2026-08-14T12:30:00.000Z',
    });

    await useRoutineStore.getState().loadFromDb(USER);

    // Sin esta guarda la pantalla de rutinas se quedaría en blanco.
    expect(useRoutineStore.getState().activeRoutineId).toBe('local');
  });
});

/**
 * Semana de ejemplo con la forma real del usuario: entreno de lunes a viernes y
 * fin de semana libre. `hasWork` mira el dia de ORIGEN, que es lo que guarda el
 * plan.
 */
const TRAINING_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const hasWork = (day: DayOfWeek | null) => day !== null && TRAINING_DAYS.includes(day);

describe('shiftWeekPlan — arrastrar la semana', () => {
  it('deja libre el origen y arrastra hasta el primer dia libre', () => {
    const next = shiftWeekPlan(identityWeekMap(), hasWork, 'monday', 'friday');

    expect(next.monday).toBeNull();
    // El viernes recibe el lunes y lo que habia el viernes baja al sabado, que
    // estaba libre. Los dias de en medio no se tocan.
    expect(next.friday).toBe('monday');
    expect(next.saturday).toBe('friday');
    expect(next.tuesday).toBe('tuesday');
    expect(next.wednesday).toBe('wednesday');
    expect(next.thursday).toBe('thursday');
  });

  it('no arrastra nada si el destino esta libre', () => {
    const next = shiftWeekPlan(identityWeekMap(), hasWork, 'tuesday', 'saturday');

    expect(next.tuesday).toBeNull();
    expect(next.saturday).toBe('tuesday');
    expect(next.sunday).toBe('sunday');
  });

  it('mover hacia atras frena en el hueco que deja el propio origen', () => {
    const next = shiftWeekPlan(identityWeekMap(), hasWork, 'friday', 'tuesday');

    expect(next.tuesday).toBe('friday');
    expect(next.wednesday).toBe('tuesday');
    expect(next.thursday).toBe('wednesday');
    expect(next.friday).toBe('thursday');
    // El arrastre se para en el hueco del viernes: el fin de semana ni se toca.
    expect(next.saturday).toBe('saturday');
    expect(next.sunday).toBe('sunday');
  });

  it('ningun entreno se pierde por el camino', () => {
    const next = shiftWeekPlan(identityWeekMap(), hasWork, 'monday', 'thursday');
    const colocados = Object.values(next).filter((d) => d !== null);

    expect(new Set(colocados).size).toBe(colocados.length);
    for (const day of TRAINING_DAYS) expect(colocados).toContain(day);
  });

  it('mover un dia de descanso no cambia la semana', () => {
    const map = identityWeekMap();

    expect(shiftWeekPlan(map, hasWork, 'sunday', 'monday')).toBe(map);
    expect(shiftWeekPlan(map, hasWork, 'monday', 'monday')).toBe(map);
  });
});

describe('plan de la semana en el store', () => {
  const USUARIO = 'user-plan-semanal';
  const semanaViva = () => weekStartOf(new Date());

  beforeEach(() => {
    const rutina = customRoutine('con-entrenos');
    rutina.days.monday = { name: 'Inferior', exercises: [{ name: 'Sentadilla', sets: 4 }] };
    rutina.days.friday = { name: 'Potencia', exercises: [{ name: 'Power clean', sets: 4 }] };

    useRoutineStore.setState({
      routines: [rutina],
      activeRoutineId: rutina.id,
      weekPlan: null,
      weekPlanUpdatedAt: null,
    });
  });

  it('mover el lunes al viernes cambia lo que toca cada dia, no la rutina', () => {
    useRoutineStore.getState().moveRoutineDay('monday', 'friday');
    const store = useRoutineStore.getState();

    expect(store.getRoutineDay('friday')?.name).toBe('Inferior');
    expect(store.getRoutineDay('saturday')?.name).toBe('Potencia');
    expect(store.getRoutineDay('monday')).toBeNull();
    // La rutina guardada sigue intacta: el lunes es el lunes.
    expect(store.getActiveRoutine()?.days.monday.name).toBe('Inferior');
  });

  it('el plan caduca solo al cambiar de semana', () => {
    useRoutineStore.getState().moveRoutineDay('monday', 'friday');
    expect(useRoutineStore.getState().getWeekPlan()).not.toBeNull();

    // Mismo plan, pero fechado la semana pasada: deja de aplicarse.
    const plan = useRoutineStore.getState().weekPlan;
    expect(plan).not.toBeNull();
    useRoutineStore.setState({
      weekPlan: { weekStart: '2026-01-05', map: plan?.map ?? identityWeekMap() },
    });

    const store = useRoutineStore.getState();
    expect(store.getWeekPlan()).toBeNull();
    expect(store.getRoutineDay('monday')?.name).toBe('Inferior');
    expect(store.getRoutineDay('friday')?.name).toBe('Potencia');
  });

  it('restaurar la semana devuelve cada entreno a su dia', () => {
    useRoutineStore.getState().moveRoutineDay('monday', 'friday');
    useRoutineStore.getState().resetWeekPlan();

    expect(useRoutineStore.getState().getWeekPlan()).toBeNull();
    expect(useRoutineStore.getState().getRoutineDay('monday')?.name).toBe('Inferior');
  });

  it('no adopta un plan remoto de otra semana', async () => {
    mockRemoteContainer({
      routines: [customRoutine('con-entrenos')],
      weekPlan: { weekStart: '2026-01-05', map: { ...identityWeekMap(), monday: null } },
      weekPlanUpdatedAt: '2026-01-05T10:00:00.000Z',
    });

    await useRoutineStore.getState().loadFromDb(USUARIO);

    expect(useRoutineStore.getState().weekPlan).toBeNull();
  });

  it('adopta el plan remoto de esta semana', async () => {
    const map = { ...identityWeekMap(), monday: null, friday: 'monday' as DayOfWeek };
    mockRemoteContainer({
      routines: [customRoutine('con-entrenos')],
      weekPlan: { weekStart: semanaViva(), map },
      weekPlanUpdatedAt: new Date().toISOString(),
    });

    await useRoutineStore.getState().loadFromDb(USUARIO);

    expect(useRoutineStore.getState().getWeekPlan()?.map.friday).toBe('monday');
  });
});

/**
 * Calendario de rutinas: la regla que decide qué bloque toca hoy.
 *
 * Los dos casos que dan sentido a todo el diseño son el retraso (se abre la app
 * el 5, no el 1) y la aplicación única (cambiar de rutina a mano el día 2 no lo
 * puede revertir el siguiente arranque).
 */
describe('dueScheduleEntry', () => {
  const SCHEDULE = { a: '2026-09-01', b: '2026-11-01' };

  it('no devuelve nada mientras no venza ninguna fecha', () => {
    expect(dueScheduleEntry(SCHEDULE, '2026-08-31', null)).toBeNull();
  });

  it('activa el bloque el día exacto', () => {
    expect(dueScheduleEntry(SCHEDULE, '2026-09-01', null)).toEqual({
      routineId: 'a',
      date: '2026-09-01',
    });
  });

  it('entra igual aunque la app se abra días más tarde', () => {
    expect(dueScheduleEntry(SCHEDULE, '2026-09-05', null)).toEqual({
      routineId: 'a',
      date: '2026-09-01',
    });
  });

  it('con dos fechas vencidas manda la más reciente, no la primera', () => {
    expect(dueScheduleEntry(SCHEDULE, '2026-12-20', null)).toEqual({
      routineId: 'b',
      date: '2026-11-01',
    });
  });

  it('no repite una entrada ya aplicada', () => {
    expect(dueScheduleEntry(SCHEDULE, '2026-09-10', '2026-09-01')).toBeNull();
  });

  it('sí aplica la siguiente aunque la anterior ya se aplicara', () => {
    expect(dueScheduleEntry(SCHEDULE, '2026-11-02', '2026-09-01')).toEqual({
      routineId: 'b',
      date: '2026-11-01',
    });
  });

  it('desempata por id para no depender del orden de las claves', () => {
    const empate = { zeta: '2026-09-01', alfa: '2026-09-01' };
    expect(dueScheduleEntry(empate, '2026-09-02', null)?.routineId).toBe('alfa');
  });
});

describe('applyDueSchedule', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFrom.mockReset();
    useRoutineStore.setState({
      routines: [...PREDEFINED_ROUTINES, customRoutine('pretemporada'), customRoutine('actual')],
      activeRoutineId: 'actual',
      activeRoutineUpdatedAt: null,
      schedule: {},
      scheduleUpdatedAt: null,
      lastScheduledApply: null,
    });
  });

  /** Ayer en formato local, para programar algo ya vencido sin tocar el reloj. */
  function ayer(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localDay(d);
  }

  it('cambia la rutina activa cuando la fecha ya pasó', () => {
    useRoutineStore.setState({ schedule: { pretemporada: ayer() } });

    const activada = useRoutineStore.getState().applyDueSchedule();

    expect(activada?.id).toBe('pretemporada');
    expect(useRoutineStore.getState().activeRoutineId).toBe('pretemporada');
  });

  it('no toca nada si la fecha aún no ha llegado', () => {
    useRoutineStore.setState({ schedule: { pretemporada: '2099-01-01' } });

    expect(useRoutineStore.getState().applyDueSchedule()).toBeNull();
    expect(useRoutineStore.getState().activeRoutineId).toBe('actual');
  });

  it('no revierte un cambio manual posterior', () => {
    useRoutineStore.setState({ schedule: { pretemporada: ayer() } });
    useRoutineStore.getState().applyDueSchedule();

    // El usuario decide volver a la anterior a mitad de bloque.
    useRoutineStore.getState().setActiveRoutine('actual');
    // Segunda comprobación (volver del segundo plano, reinicio…).
    expect(useRoutineStore.getState().applyDueSchedule()).toBeNull();
    expect(useRoutineStore.getState().activeRoutineId).toBe('actual');
  });

  it('consume la entrada aunque la rutina programada ya no exista', () => {
    useRoutineStore.setState({ schedule: { borrada: ayer() } });

    expect(useRoutineStore.getState().applyDueSchedule()).toBeNull();
    expect(useRoutineStore.getState().lastScheduledApply).toBe(ayer());
  });

  it('borrar una rutina la saca del calendario', () => {
    useRoutineStore.setState({ schedule: { pretemporada: '2099-01-01' } });

    useRoutineStore.getState().deleteRoutine('pretemporada');

    expect(useRoutineStore.getState().schedule).toEqual({});
  });
});

/**
 * El calendario tiene que viajar entre dispositivos: programarlo en el portátil
 * y que el móvil lo aplique es justo el caso de uso.
 */
describe('loadFromDb — calendario', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFrom.mockReset();
    useRoutineStore.setState({
      routines: [...PREDEFINED_ROUTINES, customRoutine('pretemporada')],
      schedule: {},
      scheduleUpdatedAt: null,
      lastScheduledApply: null,
      hydrated: false,
    });
  });

  it('adopta el calendario remoto cuando es más reciente', async () => {
    mockRemoteContainer({
      routines: [customRoutine('pretemporada')],
      schedule: { pretemporada: '2026-09-01' },
      scheduleUpdatedAt: '2026-08-31T10:00:00.000Z',
    });

    await useRoutineStore.getState().loadFromDb('user-1');

    expect(useRoutineStore.getState().schedule).toEqual({ pretemporada: '2026-09-01' });
  });

  it('conserva el calendario local si el remoto es anterior', async () => {
    useRoutineStore.setState({
      schedule: { pretemporada: '2026-09-15' },
      scheduleUpdatedAt: '2026-08-31T12:00:00.000Z',
    });
    mockRemoteContainer({
      routines: [customRoutine('pretemporada')],
      schedule: { pretemporada: '2026-09-01' },
      scheduleUpdatedAt: '2026-08-31T10:00:00.000Z',
    });

    await useRoutineStore.getState().loadFromDb('user-1');

    expect(useRoutineStore.getState().schedule).toEqual({ pretemporada: '2026-09-15' });
  });

  it('se queda con la aplicación más reciente para no repetir un bloque', async () => {
    useRoutineStore.setState({ lastScheduledApply: null });
    mockRemoteContainer({
      routines: [customRoutine('pretemporada')],
      schedule: { pretemporada: '2026-09-01' },
      scheduleUpdatedAt: '2026-09-01T08:00:00.000Z',
      lastScheduledApply: '2026-09-01',
    });

    await useRoutineStore.getState().loadFromDb('user-1');

    expect(useRoutineStore.getState().lastScheduledApply).toBe('2026-09-01');
  });
});
