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
  type DayOfWeek,
  type Routine,
} from '../routineStore';

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
