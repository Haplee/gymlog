import { beforeEach, describe, expect, it, vi } from 'vitest';

interface QueryResult {
  data: unknown;
  error: Error | null;
}

class MutationBuilder implements PromiseLike<QueryResult> {
  table = '';
  insertPayload: unknown;
  updatePayload: unknown;
  eqArgs: unknown[] = [];

  readonly insert = vi.fn((payload: unknown) => {
    this.insertPayload = payload;
    return this;
  });
  readonly update = vi.fn((payload: unknown) => {
    this.updatePayload = payload;
    return this;
  });
  readonly select = vi.fn(() => this);
  readonly delete = vi.fn(() => this);
  readonly single = vi.fn(() => this);
  readonly eq = vi.fn((...args: unknown[]) => {
    this.eqArgs = args;
    return this;
  });

  constructor(private readonly result: QueryResult) {}

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

const mocks = vi.hoisted(() => ({
  from: vi.fn<(table: string) => MutationBuilder>(),
}));

vi.mock('@shared/lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

import {
  createCustomExercise,
  updateExerciseLoadType,
} from '../../../shared/api/exerciseMutations';

let tableResults: Record<string, QueryResult>;
let builders: MutationBuilder[];

function setResult(table: string, result: QueryResult): void {
  tableResults[table] = result;
}

function buildersFor(table: string): MutationBuilder[] {
  return builders.filter((builder) => builder.table === table);
}

beforeEach(() => {
  tableResults = {};
  builders = [];
  mocks.from.mockReset();
  mocks.from.mockImplementation((table: string) => {
    const builder = new MutationBuilder(tableResults[table] ?? { data: null, error: null });
    builder.table = table;
    builders.push(builder);
    return builder;
  });
});

describe('createCustomExercise', () => {
  it('crea un ejercicio externo y sincroniza su músculo primario', async () => {
    setResult('exercises', { data: { id: 'ex-1', name: 'Press banca' }, error: null });

    const result = await createCustomExercise('user-1', {
      name: 'Press banca',
      muscle_group: 'Pecho',
      equipment: 'barra',
    });

    expect(result).toEqual({ id: 'ex-1', name: 'Press banca' });
    const exerciseBuilder = buildersFor('exercises')[0];
    expect(exerciseBuilder?.insertPayload).toEqual({
      name: 'Press banca',
      muscle_group: 'Pecho',
      equipment: 'barra',
      is_compound: false,
      is_bodyweight: false,
      load_type: 'external',
      user_id: 'user-1',
    });

    const muscleBuilders = buildersFor('exercise_muscles');
    expect(muscleBuilders[0]?.delete).toHaveBeenCalledOnce();
    expect(muscleBuilders[0]?.eqArgs).toEqual(['exercise_id', 'ex-1']);
    expect(muscleBuilders[1]?.insertPayload).toEqual([
      {
        exercise_id: 'ex-1',
        muscle_group: 'Pecho',
        role: 'primary',
        weight: 100,
      },
    ]);
  });

  it('deriva bodyweight desde el flag legacy', async () => {
    setResult('exercises', { data: { id: 'ex-2', name: 'Flexión' }, error: null });

    await createCustomExercise('user-1', {
      name: 'Flexión',
      muscle_group: 'Pecho',
      is_bodyweight: true,
    });

    expect(buildersFor('exercises')[0]?.insertPayload).toEqual(
      expect.objectContaining({
        is_bodyweight: true,
        load_type: 'bodyweight',
      }),
    );
  });

  it('respeta una modalidad explícita sobre el flag legacy', async () => {
    setResult('exercises', { data: { id: 'ex-3', name: 'Dominada lastrada' }, error: null });

    await createCustomExercise('user-1', {
      name: 'Dominada lastrada',
      muscle_group: 'Espalda',
      is_bodyweight: false,
      load_type: 'bodyweight_loaded',
    });

    expect(buildersFor('exercises')[0]?.insertPayload).toEqual(
      expect.objectContaining({
        is_bodyweight: true,
        load_type: 'bodyweight_loaded',
      }),
    );
  });

  it('inserta secundarios ponderados y descarta el primario duplicado', async () => {
    setResult('exercises', { data: { id: 'ex-4', name: 'Press militar' }, error: null });

    await createCustomExercise('user-1', {
      name: 'Press militar',
      muscle_group: 'Hombros',
      primary_weight: 80,
      secondaries: [
        { muscle_group: 'Hombros', weight: 100 },
        { muscle_group: 'Triceps', weight: 40 },
        { muscle_group: 'Pecho', weight: 20 },
      ],
    });

    expect(buildersFor('exercise_muscles')[1]?.insertPayload).toEqual([
      {
        exercise_id: 'ex-4',
        muscle_group: 'Hombros',
        role: 'primary',
        weight: 80,
      },
      {
        exercise_id: 'ex-4',
        muscle_group: 'Triceps',
        role: 'secondary',
        weight: 40,
      },
      {
        exercise_id: 'ex-4',
        muscle_group: 'Pecho',
        role: 'secondary',
        weight: 20,
      },
    ]);
  });

  it('rechaza datos inválidos antes de consultar Supabase', async () => {
    await expect(
      createCustomExercise('user-1', { name: '', muscle_group: 'Pecho' }),
    ).rejects.toThrow('Nombre requerido');
    await expect(
      createCustomExercise('user-1', {
        name: 'Press',
        muscle_group: 'Pecho',
        secondaries: [{ muscle_group: 'Triceps', weight: 101 }],
      }),
    ).rejects.toThrow();

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('propaga un error al crear el ejercicio', async () => {
    setResult('exercises', { data: null, error: new Error('RLS bloquea la escritura') });

    await expect(
      createCustomExercise('user-1', { name: 'Press', muscle_group: 'Pecho' }),
    ).rejects.toThrow('RLS bloquea la escritura');
    expect(buildersFor('exercise_muscles')).toHaveLength(0);
  });

  it('propaga un error al sincronizar los músculos', async () => {
    setResult('exercises', { data: { id: 'ex-5', name: 'Remo' }, error: null });
    setResult('exercise_muscles', {
      data: null,
      error: new Error('No se pudo guardar el músculo'),
    });

    await expect(
      createCustomExercise('user-1', { name: 'Remo', muscle_group: 'Espalda' }),
    ).rejects.toThrow('No se pudo guardar el músculo');
  });
});

describe('updateExerciseLoadType', () => {
  it('actualiza la modalidad y mantiene coherente el flag legacy', async () => {
    await updateExerciseLoadType('ex-1', 'bodyweight_loaded');

    const builder = buildersFor('exercises')[0];
    expect(builder?.updatePayload).toEqual({
      load_type: 'bodyweight_loaded',
      is_bodyweight: true,
    });
    expect(builder?.eqArgs).toEqual(['id', 'ex-1']);
  });

  it('marca como external un ejercicio con carga externa', async () => {
    await updateExerciseLoadType('ex-2', 'external');

    expect(buildersFor('exercises')[0]?.updatePayload).toEqual({
      load_type: 'external',
      is_bodyweight: false,
    });
  });

  it('propaga el error de Supabase', async () => {
    setResult('exercises', { data: null, error: new Error('No se pudo actualizar') });

    await expect(updateExerciseLoadType('ex-3', 'external')).rejects.toThrow(
      'No se pudo actualizar',
    );
  });
});
