import { describe, it, expect } from 'vitest';
import { parseImportedWorkouts } from '../importSchema';

const AHORA = new Date('2026-08-14T09:00:00.000Z');

function set(overrides: Record<string, unknown> = {}) {
  return {
    exercise: 'Sentadilla',
    set_num: 1,
    reps: 5,
    weight: 120,
    is_warmup: false,
    notes: '',
    rpe: null,
    ...overrides,
  };
}

describe('parseImportedWorkouts', () => {
  it('agrupa las series por ejercicio y deriva la fecha', () => {
    const { workouts } = parseImportedWorkouts(
      [
        {
          started_at: '2026-08-10T07:14:00.000Z',
          finished_at: '2026-08-10T08:30:00.000Z',
          sets: [set(), set({ set_num: 2 }), set({ exercise: 'Press banca', weight: 85 })],
        },
      ],
      AHORA,
    );

    expect(workouts).toHaveLength(1);
    expect(workouts[0].date).toBe('2026-08-10');
    expect([...workouts[0].byExercise.keys()]).toEqual(['Sentadilla', 'Press banca']);
    expect(workouts[0].byExercise.get('Sentadilla')).toHaveLength(2);
  });

  it('descarta las series sin ejercicio o sin repeticiones', () => {
    const { workouts, droppedSets } = parseImportedWorkouts(
      [
        {
          started_at: '2026-08-10T07:00:00.000Z',
          sets: [set(), set({ exercise: '  ' }), set({ reps: 0 })],
        },
      ],
      AHORA,
    );

    expect(droppedSets).toBe(2);
    expect(workouts[0].byExercise.get('Sentadilla')).toHaveLength(1);
  });

  /**
   * El comportamiento anterior era `Number(s.reps) || 0`: un valor absurdo se
   * convertía en 0 y entraba igual, contaminando volumen y PRs sin avisar.
   */
  it('rechaza valores fuera de rango en vez de convertirlos en cero', () => {
    const { droppedSets } = parseImportedWorkouts(
      [
        {
          started_at: '2026-08-10T07:00:00.000Z',
          sets: [set({ reps: 999999 }), set({ reps: -3 }), set({ reps: 'muchas' })],
        },
      ],
      AHORA,
    );

    expect(droppedSets).toBe(3);
  });

  it('acepta números escritos como texto, que es lo que trae medio Excel', () => {
    const { workouts } = parseImportedWorkouts(
      [{ started_at: '2026-08-10T07:00:00.000Z', sets: [set({ reps: '5', weight: '120.5' })] }],
      AHORA,
    );

    const [s] = workouts[0].byExercise.get('Sentadilla') ?? [];
    expect(s.reps).toBe(5);
    expect(s.weight).toBe(120.5);
  });

  it('el peso cero es válido: hay ejercicios a peso corporal', () => {
    const { workouts, droppedSets } = parseImportedWorkouts(
      [{ started_at: '2026-08-10T07:00:00.000Z', sets: [set({ weight: 0 })] }],
      AHORA,
    );

    expect(droppedSets).toBe(0);
    expect(workouts[0].byExercise.get('Sentadilla')?.[0].weight).toBe(0);
  });

  it('sin fecha usa la de hoy en vez de romper', () => {
    const { workouts } = parseImportedWorkouts([{ sets: [set()] }], AHORA);

    expect(workouts[0].date).toBe('2026-08-14');
    // Sin finished_at se iguala al inicio, no queda a null.
    expect(workouts[0].finishedAt).toBe(workouts[0].startedAt);
  });

  it('el entreno que se queda sin series válidas no se importa', () => {
    const { workouts, droppedWorkouts } = parseImportedWorkouts(
      [{ started_at: '2026-08-10T07:00:00.000Z', sets: [set({ reps: 0 })] }],
      AHORA,
    );

    expect(workouts).toHaveLength(0);
    expect(droppedWorkouts).toBe(1);
  });

  it('un fichero con forma inesperada devuelve cero entrenos y no lanza', () => {
    expect(parseImportedWorkouts(null).workouts).toEqual([]);
    expect(parseImportedWorkouts('texto').workouts).toEqual([]);
    expect(parseImportedWorkouts({ workouts: [] }).workouts).toEqual([]);
  });
});
