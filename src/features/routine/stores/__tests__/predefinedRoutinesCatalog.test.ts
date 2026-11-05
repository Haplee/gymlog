// @vitest-environment jsdom
// Mismo motivo que en routineStore.test.ts: el store arrastra el cliente de
// Supabase, que toca `window.localStorage` al importarse.
import { describe, it, expect, vi } from 'vitest';

vi.mock('@shared/lib/supabase', () => ({ supabase: { from: vi.fn() } }));
import { PREDEFINED_ROUTINES, type DayOfWeek } from '../routineStore';
import { normalizeExerciseName } from '@shared/lib/progressionCycle';
import { isBodyweightLoad } from '@shared/lib/loadType';
import { PUBLIC_CATALOG_LOAD_TYPE } from './fixtures/publicCatalog';

const DAYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** Nombres únicos que piden las plantillas, con el primer sitio donde salen. */
function templateExercises(): Map<string, string> {
  const names = new Map<string, string>();
  for (const routine of PREDEFINED_ROUTINES) {
    for (const day of DAYS) {
      for (const ex of routine.days[day].exercises) {
        if (!names.has(ex.name)) names.set(ex.name, `${routine.id}/${day}`);
      }
    }
  }
  return names;
}

const catalogByNormalizedName = new Map(
  Object.entries(PUBLIC_CATALOG_LOAD_TYPE).map(([name, loadType]) => [
    normalizeExerciseName(name),
    { name, loadType },
  ]),
);

describe('catálogo de las plantillas predefinidas', () => {
  // La app resuelve el nombre de la rutina contra el catálogo normalizado; si no
  // lo encuentra, al guardar la sesión crea un ejercicio custom. Esta prueba es
  // la que impide que una plantilla vuelva a pedir nombres inventados.
  it('todos sus ejercicios existen en el catálogo público', () => {
    const missing = [...templateExercises()]
      .filter(([name]) => !catalogByNormalizedName.has(normalizeExerciseName(name)))
      .map(([name, where]) => `${name} (${where})`);

    expect(missing).toEqual([]);
  });

  it('no hay dos nombres de plantilla que resuelvan al mismo ejercicio', () => {
    const byCanonical = new Map<string, string[]>();
    for (const name of templateExercises().keys()) {
      const canonical = catalogByNormalizedName.get(normalizeExerciseName(name))?.name;
      if (!canonical) continue;
      byCanonical.set(canonical, [...(byCanonical.get(canonical) ?? []), name]);
    }

    const duplicated = [...byCanonical.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([canonical, names]) => `${canonical}: ${names.join(', ')}`);

    expect(duplicated).toEqual([]);
  });

  it('los ejercicios nuevos de la migración resuelven con su tipo de carga', () => {
    const nuevos = [
      ['Curl femoral sentado', 'external'],
      ['Elevaciones disco', 'external'],
      ['Power Clean', 'external'],
      ['Power Snatch', 'external'],
      ['Plancha lateral', 'bodyweight'],
      ['Rotación externa con goma', 'external'],
      ['Lanzamiento de balón medicinal', 'external'],
      ['Sentadilla parcial', 'external'],
      ['Press Pallof', 'external'],
      ['Curl nórdico', 'bodyweight'],
      ['Leñador en polea', 'external'],
    ] as const;

    for (const [name, loadType] of nuevos) {
      const row = catalogByNormalizedName.get(normalizeExerciseName(name));
      expect(row, `${name} no está en el catálogo`).toBeDefined();
      expect(row?.loadType, `${name} tiene otro tipo de carga`).toBe(loadType);
    }
  });

  it('los ejercicios de peso corporal de la plantilla se marcan como tales', () => {
    for (const name of templateExercises().keys()) {
      const row = catalogByNormalizedName.get(normalizeExerciseName(name));
      if (!row) continue;
      if (/plancha|crunch|rueda abdominal|salto|skater|nórdico/i.test(name)) {
        expect(isBodyweightLoad(row.loadType), `${name} debería ser de peso corporal`).toBe(true);
      }
    }
  });
});
