import { beforeEach, describe, expect, it, vi } from 'vitest';

interface QueryResult {
  data: unknown;
  error: Error | null;
}

class QueryBuilder implements PromiseLike<QueryResult> {
  readonly select = vi.fn((..._args: unknown[]) => this);
  readonly insert = vi.fn((..._args: unknown[]) => this);
  readonly update = vi.fn((..._args: unknown[]) => this);
  readonly upsert = vi.fn((..._args: unknown[]) => this);
  readonly delete = vi.fn((..._args: unknown[]) => this);
  readonly eq = vi.fn((..._args: unknown[]) => this);
  readonly neq = vi.fn((..._args: unknown[]) => this);
  readonly gt = vi.fn((..._args: unknown[]) => this);
  readonly gte = vi.fn((..._args: unknown[]) => this);
  readonly lt = vi.fn((..._args: unknown[]) => this);
  readonly lte = vi.fn((..._args: unknown[]) => this);
  readonly order = vi.fn((..._args: unknown[]) => this);
  readonly limit = vi.fn((..._args: unknown[]) => this);
  readonly range = vi.fn((..._args: unknown[]) => this);
  readonly in = vi.fn((..._args: unknown[]) => this);
  readonly not = vi.fn((..._args: unknown[]) => this);
  readonly or = vi.fn((..._args: unknown[]) => this);
  readonly single = vi.fn(() => this);

  constructor(
    readonly table: string,
    private readonly result: QueryResult,
  ) {}

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn<(table: string) => unknown>(),
  rpcMock: vi.fn<(name: string, args?: Record<string, unknown>) => Promise<unknown>>(),
}));

vi.mock('@shared/lib/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
  },
}));

import {
  addBodyMeasurement,
  deleteBodyMeasurement,
  deleteExercise,
  deleteExerciseGoal,
  deleteExerciseNote,
  fetchBodyMeasurements,
  fetchExerciseGoals,
  fetchExerciseLibrary,
  fetchExerciseMuscles,
  fetchExerciseMusclesMap,
  fetchExerciseNotes,
  fetchExerciseSessions,
  fetchExercises,
  fetchExistingSetKeysBetween,
  fetchFavoriteExerciseIds,
  fetchLastExerciseSets,
  fetchPersonalRecords,
  fetchRecentMuscleSets,
  fetchRecentSets,
  fetchWorkouts,
  fetchWorkoutsAndSets,
  fetchWorkoutsPaginated,
  insertMissingWeights,
  saveExerciseNote,
  toggleFavoriteExercise,
  upsertExerciseGoal,
  upsertTodayWeight,
} from '../queries';

const empty = (): QueryResult => ({ data: [], error: null });
const failure = (message = 'error de consulta'): QueryResult => ({
  data: null,
  error: new Error(message),
});

let tableResults: Record<string, QueryResult>;
let tableQueues: Record<string, QueryResult[]>;
let rpcResults: Record<string, QueryResult>;
let builders: QueryBuilder[];

function setTable(table: string, result: QueryResult): void {
  tableResults[table] = result;
}

function queueTable(table: string, ...results: QueryResult[]): void {
  tableQueues[table] = results;
}

function latestBuilder(table: string): QueryBuilder {
  const builder = builders.findLast((candidate) => candidate.table === table);
  if (!builder) throw new Error(`No se creó un builder para ${table}`);
  return builder;
}

beforeEach(() => {
  tableResults = {};
  tableQueues = {};
  rpcResults = {};
  builders = [];

  mocks.fromMock.mockReset();
  mocks.rpcMock.mockReset();

  mocks.fromMock.mockImplementation((table: string) => {
    const result = tableQueues[table]?.shift() ?? tableResults[table] ?? empty();
    const builder = new QueryBuilder(table, result);
    builders.push(builder);
    return builder;
  });

  mocks.rpcMock.mockImplementation(async (name: string) => rpcResults[name] ?? empty());
});

describe('queries: lecturas de entrenamiento', () => {
  const workout = {
    id: 'workout-1',
    user_id: 'user-1',
    started_at: '2026-10-20T10:00:00.000Z',
    finished_at: '2026-10-20T11:00:00.000Z',
    sets: [
      {
        id: 'set-1',
        workout_id: 'workout-1',
        exercise_id: 'exercise-1',
        reps: 8,
        weight: 60,
        set_num: 1,
        created_at: '2026-10-20T10:30:00.000Z',
        is_warmup: false,
        rpe: 8,
        exercise: { name: 'Press banca', muscle_group: 'Pecho' },
        workout: { started_at: '2026-10-20T10:00:00.000Z' },
      },
    ],
  };

  it('devuelve entrenamientos y series validados desde la RPC', async () => {
    rpcResults.get_workouts_with_sets = { data: [workout], error: null };

    const result = await fetchWorkoutsAndSets('user-1');

    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0]?.ended_at).toBe('2026-10-20T11:00:00.000Z');
    expect(result.sets[0]?.exercise.name).toBe('Press banca');
    expect(mocks.rpcMock).toHaveBeenCalledWith('get_workouts_with_sets', {
      p_user_id: 'user-1',
      p_limit: 200,
      p_cursor: null,
    });
  });

  it('calcula el cursor y recorta las series recientes por fecha', async () => {
    rpcResults.get_workouts_with_sets = { data: [workout], error: null };

    const page = await fetchWorkoutsPaginated('user-1', null, 1);
    const recent = await fetchRecentSets('user-1', 10);

    expect(page).toEqual({
      workouts: expect.arrayContaining([expect.objectContaining({ id: 'workout-1' })]),
      nextCursor: '2026-10-20T10:00:00.000Z',
    });
    expect(recent[0]?.id).toBe('set-1');
  });

  it('usa el camino legacy cuando la RPC no existe', async () => {
    rpcResults.get_workouts_with_sets = failure('RPC no encontrada');
    setTable('workouts', { data: [workout], error: null });
    setTable('workout_sets', { data: workout.sets, error: null });

    const result = await fetchWorkouts('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.sets[0]?.weight).toBe(60);
  });

  it('propaga el error del fallback cuando la RPC no está disponible', async () => {
    rpcResults.get_workouts_with_sets = failure('RPC no encontrada');
    setTable('workouts', failure('timeout de postgres'));

    await expect(fetchWorkoutsAndSets('user-1')).rejects.toThrow('timeout de postgres');
  });

  it('extrae claves de series existentes y normaliza joins en objeto o array', async () => {
    setTable('workout_sets', {
      data: [
        {
          set_num: 1,
          exercise: { name: 'Sentadilla' },
          workout: { started_at: '2026-10-20T10:00:00.000Z' },
        },
        {
          set_num: 2,
          exercise: [{ name: 'Peso muerto' }],
          workout: [{ started_at: '2026-10-21T10:00:00.000Z' }],
        },
        { set_num: 3, exercise: null, workout: null },
      ],
      error: null,
    });

    const keys = await fetchExistingSetKeysBetween('user-1', '2026-10-20', '2026-10-21');

    expect(keys).toEqual([
      { date: '2026-10-20', exercise: 'Sentadilla', setNum: 1 },
      { date: '2026-10-21', exercise: 'Peso muerto', setNum: 2 },
    ]);
  });
});

describe('queries: catálogo de ejercicios', () => {
  it('lista el catálogo público sin usuario', async () => {
    setTable('exercises', { data: [{ id: 'ex-1', name: 'Sentadilla' }], error: null });

    const result = await fetchExercises(undefined);

    expect(result[0]?.name).toBe('Sentadilla');
  });

  it('usa la RPC de ejercicios propios y públicos con usuario', async () => {
    rpcResults.get_exercises_with_usage = {
      data: [{ id: 'ex-1', name: 'Press banca', usage_count: 4 }],
      error: null,
    };

    const result = await fetchExercises('user-1');

    expect(result[0]?.name).toBe('Press banca');
    expect(mocks.rpcMock).toHaveBeenCalledWith('get_exercises_with_usage', {
      p_user_id: 'user-1',
    });
  });

  it('degrada a la consulta simple si falla la RPC de catálogo', async () => {
    rpcResults.get_exercises_with_usage = failure('RPC ausente');
    setTable('exercises', { data: [{ id: 'ex-1', name: 'Remo' }], error: null });

    const result = await fetchExercises('user-1');

    expect(result[0]?.name).toBe('Remo');
  });

  it('agrupa músculos y construye el mapa sin consultas N+1', async () => {
    setTable('exercise_muscles', {
      data: [
        { exercise_id: 'ex-1', muscle_group: 'Pecho', role: 'secondary', weight: 40 },
        { exercise_id: 'ex-1', muscle_group: 'Triceps', role: 'primary', weight: 100 },
      ],
      error: null,
    });

    const muscles = await fetchExerciseMuscles('ex-1');
    const map = await fetchExerciseMusclesMap('user-1');

    expect(muscles[0]?.muscle_group).toBe('Triceps');
    expect(map['ex-1']).toHaveLength(2);
  });

  it('propaga errores al leer músculos', async () => {
    setTable('exercise_muscles', failure('RLS'));

    await expect(fetchExerciseMuscles('ex-1')).rejects.toThrow('RLS');
    await expect(fetchExerciseMusclesMap('user-1')).rejects.toThrow('RLS');
  });

  it('consulta la biblioteca con y sin usuario', async () => {
    setTable('exercises', { data: [{ id: 'ex-1', name: 'Curl' }], error: null });

    const result = await fetchExerciseLibrary('user-1');

    expect(result[0]?.name).toBe('Curl');
    expect(latestBuilder('exercises').or).toHaveBeenCalled();
  });
});

describe('queries: notas, récords y favoritos', () => {
  it('obtiene récords y notas propias', async () => {
    setTable('personal_records', { data: [{ id: 'pr-1', user_id: 'user-1' }], error: null });
    setTable('exercise_notes', {
      data: [{ id: 'note-1', note: 'Usar agarre neutro' }],
      error: null,
    });

    const records = await fetchPersonalRecords('user-1');
    const notes = await fetchExerciseNotes('user-1', 'ex-1');

    expect(records).toHaveLength(1);
    expect(notes[0]?.note).toBe('Usar agarre neutro');
  });

  it('crea y elimina una nota', async () => {
    setTable('exercise_notes', { data: { id: 'note-1', note: 'Nota' }, error: null });

    const note = await saveExerciseNote('user-1', 'ex-1', 'Nota');
    await deleteExerciseNote('note-1');

    expect(note.id).toBe('note-1');
    expect(latestBuilder('exercise_notes').delete).toHaveBeenCalled();
  });

  it('elimina un ejercicio propio', async () => {
    setTable('exercises', empty());

    await deleteExercise('ex-1');

    expect(latestBuilder('exercises').delete).toHaveBeenCalled();
  });

  it('lee favoritos y alterna el estado sin duplicar la operación', async () => {
    setTable('exercise_favorites', {
      data: [{ exercise_id: 'ex-1' }],
      error: null,
    });

    const ids = await fetchFavoriteExerciseIds('user-1');
    const removed = await toggleFavoriteExercise('user-1', 'ex-1', true);
    const added = await toggleFavoriteExercise('user-1', 'ex-2', false);

    expect(ids).toEqual(['ex-1']);
    expect(removed).toBe(false);
    expect(added).toBe(true);
  });

  it('devuelve favoritos vacíos si la tabla no está disponible', async () => {
    setTable('exercise_favorites', failure('tabla ausente'));

    await expect(fetchFavoriteExerciseIds('user-1')).resolves.toEqual([]);
  });
});

describe('queries: series por ejercicio y contexto muscular', () => {
  it('devuelve solo las series del último día del ejercicio', async () => {
    setTable('workouts', {
      data: [
        { id: 'w-1', started_at: '2026-10-20T10:00:00.000Z' },
        { id: 'w-2', started_at: '2026-10-21T10:00:00.000Z' },
      ],
      error: null,
    });
    setTable('workout_sets', {
      data: [
        { workout_id: 'w-1', reps: 8, weight: 60, set_num: 1 },
        { workout_id: 'w-2', reps: 5, weight: 80, set_num: 1 },
        { workout_id: 'w-2', reps: 5, weight: 80, set_num: 2 },
      ],
      error: null,
    });

    const result = await fetchLastExerciseSets('user-1', 'ex-1');

    expect(result).toHaveLength(2);
    expect(result.every((set) => set.weight === 80)).toBe(true);
  });

  it('agrupa sesiones de ejercicio con RIR y RPE', async () => {
    setTable('workouts', {
      data: [{ id: 'w-1', started_at: '2026-10-20T10:00:00.000Z' }],
      error: null,
    });
    setTable('workout_sets', {
      data: [{ workout_id: 'w-1', weight: 60, reps: 8, rir: 2, rpe: 8 }],
      error: null,
    });

    const result = await fetchExerciseSessions('user-1', 'ex-1');

    expect(result[0]?.sets[0]).toEqual({ weight: 60, reps: 8, rir: 2, rpe: 8 });
  });

  it('devuelve vacío cuando no hay entrenamientos o series', async () => {
    setTable('workouts', empty());
    await expect(fetchLastExerciseSets('user-1', 'ex-1')).resolves.toEqual([]);
    await expect(fetchExerciseSessions('user-1', 'ex-1')).resolves.toEqual([]);

    setTable('workouts', { data: [{ id: 'w-1', started_at: null }], error: null });
    setTable('workout_sets', empty());
    await expect(fetchLastExerciseSets('user-1', 'ex-1')).resolves.toEqual([]);
    await expect(fetchExerciseSessions('user-1', 'ex-1')).resolves.toEqual([]);
  });

  it('devuelve el contexto muscular reciente y descarta joins incompletos', async () => {
    setTable('workouts', {
      data: [{ id: 'w-1', started_at: '2026-10-20T10:00:00.000Z' }],
      error: null,
    });
    setTable('workout_sets', {
      data: [
        { workout_id: 'w-1', exercise: { muscle_group: 'Pecho' } },
        { workout_id: 'w-1', exercise: [] },
      ],
      error: null,
    });

    const result = await fetchRecentMuscleSets('user-1', 28);

    expect(result).toEqual([{ date: '2026-10-20T10:00:00.000Z', muscleGroup: 'Pecho' }]);
  });
});

describe('queries: medidas corporales', () => {
  it('obtiene y guarda las medidas del día', async () => {
    queueTable(
      'body_measurements',
      { data: [{ id: 'measure-1', user_id: 'user-1', date: '2026-10-20' }], error: null },
      { data: { id: 'measure-1', user_id: 'user-1', date: '2026-10-20' }, error: null },
    );

    const measurements = await fetchBodyMeasurements('user-1');
    const added = await addBodyMeasurement('user-1', { weight_kg: 80, body_fat_pct: 15 });

    expect(measurements[0]?.id).toBe('measure-1');
    expect(added.id).toBe('measure-1');
  });

  it('actualiza el peso de hoy mediante upsert', async () => {
    setTable('body_measurements', empty());

    await upsertTodayWeight('user-1', 79.5);

    expect(latestBuilder('body_measurements').upsert).toHaveBeenCalled();
  });

  it('inserta únicamente pesos que faltan y conserva los existentes', async () => {
    queueTable(
      'body_measurements',
      { data: [{ date: '2026-10-19' }], error: null },
      { data: null, error: null },
    );

    const result = await insertMissingWeights('user-1', [
      { date: '2026-10-19', weightKg: 80 },
      { date: '2026-10-20', weightKg: 79.5 },
    ]);

    expect(result).toEqual({ inserted: 1, skipped: 1 });
  });

  it('no consulta si no hay pesos importados', async () => {
    const result = await insertMissingWeights('user-1', []);

    expect(result).toEqual({ inserted: 0, skipped: 0 });
    expect(mocks.fromMock).not.toHaveBeenCalled();
  });

  it('elimina una medida corporal', async () => {
    setTable('body_measurements', empty());

    await deleteBodyMeasurement('measure-1');

    expect(latestBuilder('body_measurements').delete).toHaveBeenCalled();
  });

  it('propaga los errores del CRUD de medidas', async () => {
    setTable('body_measurements', failure('no autorizado'));

    await expect(fetchBodyMeasurements('user-1')).rejects.toThrow('no autorizado');
    await expect(
      addBodyMeasurement('user-1', { weight_kg: 80, body_fat_pct: null }),
    ).rejects.toThrow('no autorizado');
    await expect(upsertTodayWeight('user-1', 80)).rejects.toThrow('no autorizado');
    await expect(deleteBodyMeasurement('measure-1')).rejects.toThrow('no autorizado');
  });
});

describe('queries: objetivos de fuerza', () => {
  it('obtiene, crea y elimina objetivos', async () => {
    setTable('exercise_goals', {
      data: [{ id: 'goal-1', exercise_id: 'ex-1', target_one_rm: 100 }],
      error: null,
    });

    const goals = await fetchExerciseGoals('user-1');
    await upsertExerciseGoal('user-1', 'ex-1', 100);
    const upsertBuilder = latestBuilder('exercise_goals');
    await deleteExerciseGoal('user-1', 'ex-1');
    const deleteBuilder = latestBuilder('exercise_goals');

    expect(goals[0]?.target_one_rm).toBe(100);
    expect(upsertBuilder.upsert).toHaveBeenCalled();
    expect(deleteBuilder.delete).toHaveBeenCalled();
  });

  it('degrada a lista vacía si la tabla de objetivos falla', async () => {
    setTable('exercise_goals', failure('tabla ausente'));

    await expect(fetchExerciseGoals('user-1')).resolves.toEqual([]);
  });
});
