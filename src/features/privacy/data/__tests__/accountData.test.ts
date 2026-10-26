import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { fetchAccountSnapshot, requestAccountDeletion } from '../accountData';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  rows: {} as Record<string, unknown[]>,
  failTables: new Set<string>(),
  inCalls: [] as { table: string; values: unknown[] }[],
}));

vi.mock('@shared/lib/supabase', () => {
  const builderFor = (table: string) => {
    let rows = mocks.rows[table] ?? [];
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: (column: string, values: unknown[]) => {
        mocks.inCalls.push({ table, values });
        // Como PostgREST: solo devuelve las filas que casan con el `in`.
        rows = rows.filter((row) => {
          const value = (row as Record<string, unknown>)[column];
          return value === undefined || values.includes(value);
        });
        return builder;
      },
      range: async (from: number, to: number) => {
        if (mocks.failTables.has(table)) {
          return { data: null, error: { message: `fallo en ${table}` } };
        }
        return { data: rows.slice(from, to + 1), error: null };
      },
    };
    return builder;
  };

  return {
    supabase: {
      from: (table: string) => builderFor(table),
      functions: { invoke: mocks.invoke },
    },
  };
});

const user = { id: 'user-1', email: 'persona@example.test' } as User;

beforeEach(() => {
  mocks.invoke.mockReset();
  mocks.rows = {};
  mocks.failTables = new Set();
  mocks.inCalls = [];
});

describe('fetchAccountSnapshot', () => {
  it('pagina hasta agotar y agrupa las series por tandas de entrenos', async () => {
    mocks.rows.profiles = [{ id: 'user-1', avatar_url: 'https://example.test/a.png' }];
    mocks.rows.body_measurements = Array.from({ length: 1200 }, (_, i) => ({ id: `m${i}` }));
    mocks.rows.workouts = Array.from({ length: 150 }, (_, i) => ({ id: `w${i}` }));
    mocks.rows.workout_sets = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      workout_id: `w${i * 15}`,
    }));
    mocks.rows.exercises = [
      { id: 'ex-1', user_id: 'user-1' },
      { id: 'ex-2', user_id: 'user-1' },
    ];
    mocks.rows.exercise_muscles = [
      { id: 'em-1', exercise_id: 'ex-1', muscle_group: 'Pecho' },
      { id: 'em-2', exercise_id: 'ex-2', muscle_group: 'Espalda' },
      { id: 'em-3', exercise_id: 'catalogo', muscle_group: 'Pierna' },
    ];

    const snapshot = await fetchAccountSnapshot(user);

    expect(snapshot.tables.profiles).toHaveLength(1);
    expect(snapshot.tables.body_measurements).toHaveLength(1200);
    expect(snapshot.tables.workouts).toHaveLength(150);
    expect(snapshot.tables.workout_sets).toHaveLength(10);
    expect(snapshot.tables.exercise_muscles).toHaveLength(2);
    expect(snapshot.avatarUrl).toBe('https://example.test/a.png');
    expect(snapshot.errors).toEqual({});

    const setCalls = mocks.inCalls.filter((call) => call.table === 'workout_sets');
    expect(setCalls.map((call) => call.values.length)).toEqual([100, 50]);

    const muscleCalls = mocks.inCalls.filter((call) => call.table === 'exercise_muscles');
    expect(muscleCalls[0]?.values).toEqual(['ex-1', 'ex-2']);
  });

  it('incluye las tablas del entrenador cuando existen', async () => {
    mocks.rows.ai_coach_messages = [{ id: 'msg-1', user_id: 'user-1' }];
    mocks.rows.ai_coach_memory = [{ id: 'mem-1', user_id: 'user-1' }];

    const snapshot = await fetchAccountSnapshot(user);

    expect(snapshot.tables.ai_coach_messages).toHaveLength(1);
    expect(snapshot.tables.ai_coach_memory).toHaveLength(1);
    expect(snapshot.errors).toEqual({});
  });

  it('anota una tabla opcional que falla y sigue exportando el resto', async () => {
    mocks.rows.profiles = [{ id: 'user-1' }];
    mocks.failTables.add('ai_coach_usage');

    const snapshot = await fetchAccountSnapshot(user);

    expect(snapshot.tables.profiles).toHaveLength(1);
    expect(snapshot.errors?.ai_coach_usage).toContain('ai_coach_usage');
  });

  it('aborta si falla una tabla obligatoria', async () => {
    mocks.failTables.add('workouts');

    await expect(fetchAccountSnapshot(user)).rejects.toThrow('workouts');
  });
});

describe('requestAccountDeletion', () => {
  it('invoca la función sin enviar ningún identificador', async () => {
    mocks.invoke.mockResolvedValue({ data: { deleted: true }, error: null });

    await expect(requestAccountDeletion()).resolves.toEqual({ error: null });
    expect(mocks.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
    expect(JSON.stringify(mocks.invoke.mock.calls)).not.toContain('user-1');
  });

  it('devuelve el mensaje de error de la plataforma', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { message: 'FunctionsHttpError' } });
    await expect(requestAccountDeletion()).resolves.toEqual({ error: 'FunctionsHttpError' });
  });

  it('devuelve el error del cuerpo si la función responde 200 con error', async () => {
    mocks.invoke.mockResolvedValue({ data: { error: 'delete_failed' }, error: null });
    await expect(requestAccountDeletion()).resolves.toEqual({ error: 'delete_failed' });
  });
});
