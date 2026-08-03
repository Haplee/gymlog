// @vitest-environment jsdom
// El store arrastra el cliente de Supabase, que toca `window.localStorage` al
// importarse; sin DOM el módulo ni siquiera carga. En CI no hay variables de
// entorno, así que `createClient('', '')` reventaría al importar: se sustituye
// el cliente real por uno vacío, igual que en los tests hermanos.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@shared/lib/supabase', () => ({ supabase: { from: vi.fn() } }));
import {
  useRoutineStore,
  PREDEFINED_ROUTINES,
  type DayOfWeek,
  type Routine,
} from '../routineStore';

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

  it('la rutina de balonmano entrena cuatro días y libera el fin de semana', () => {
    const balonmano = PREDEFINED_ROUTINES.find((r) => r.id === 'balonmano-fuerza');
    if (!balonmano) throw new Error('falta la plantilla balonmano-fuerza');

    const conEjercicios = DAYS.filter((d) => balonmano.days[d].exercises.length > 0);
    expect(conEjercicios).toEqual(['monday', 'tuesday', 'thursday', 'friday']);
    expect(balonmano.days.saturday.exercises).toHaveLength(0);
    expect(balonmano.days.sunday.exercises).toHaveLength(0);
  });
});
