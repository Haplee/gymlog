import { beforeEach, describe, expect, it, vi } from 'vitest';

// Servidor de mentira para la RPC: guarda por `p_client_id` y, como el real, un
// reenvío con la misma clave devuelve el mismo entreno en vez de crear otro. Es
// lo mínimo para poder probar el contrato de idempotencia desde el cliente sin
// fingir que un `.insert()` suelto sigue siendo el camino.
const h = vi.hoisted(() => {
  interface FakeWorkout {
    id: string;
    user_id: string;
    started_at: string;
    client_id: string;
    sets: Record<string, unknown>[];
  }

  interface FakeCardio {
    id: string;
    user_id: string;
    client_id: string;
    started_at: string;
    content: string;
  }

  const workouts: FakeWorkout[] = [];
  const exercises: { name: string; user_id: string }[] = [];
  const cardio: FakeCardio[] = [];
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  let seq = 0;
  let failRpc = false;
  let loseNextResponse = false;

  const saveWorkout = (args: Record<string, unknown>): string => {
    const existing = workouts.find(
      (w) => w.user_id === args.p_user_id && w.client_id === args.p_client_id,
    );
    if (existing) return existing.id;
    const id = `workout-${++seq}`;
    workouts.push({
      id,
      user_id: String(args.p_user_id),
      started_at: String(args.p_started_at),
      client_id: String(args.p_client_id),
      sets: (args.p_sets ?? []) as Record<string, unknown>[],
    });
    return id;
  };

  const cardioContent = (args: Record<string, unknown>) =>
    JSON.stringify([
      args.p_type,
      String(args.p_started_at),
      args.p_duration,
      args.p_distance ?? null,
      args.p_calories ?? null,
      args.p_notes ?? null,
      args.p_avg_hr ?? null,
      args.p_max_hr ?? null,
    ]);

  const saveCardio = (args: Record<string, unknown>) => {
    const existing = cardio.find(
      (c) => c.user_id === args.p_user_id && c.client_id === args.p_client_id,
    );
    if (existing) {
      if (existing.content !== cardioContent(args)) {
        return { data: null, error: { message: 'idempotency_conflict' } };
      }
      return { data: existing.id, error: null };
    }

    const id = `cardio-${++seq}`;
    cardio.push({
      id,
      user_id: String(args.p_user_id),
      client_id: String(args.p_client_id),
      started_at: String(args.p_started_at),
      content: cardioContent(args),
    });
    return { data: id, error: null };
  };

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });
    if (failRpc) return { data: null, error: new Error('fallo simulado en la RPC') };

    const result =
      fn === 'save_cardio_session' ? saveCardio(args) : { data: saveWorkout(args), error: null };
    if (result.error) return result;

    // Simula «el servidor escribió y la respuesta se perdió»: la siguiente
    // llamada con la misma clave debe encontrar la fila ya creada.
    if (loseNextResponse) {
      loseNextResponse = false;
      throw new TypeError('Failed to fetch');
    }
    return result;
  };

  const from = (table: string) => {
    let ultimo: Record<string, unknown> = {};
    const builder = {
      insert: (payload: Record<string, unknown>) => {
        ultimo = payload;
        if (table === 'exercises') exercises.push(payload as { name: string; user_id: string });
        return builder;
      },
      select: () => builder,
      single: async () => {
        if (table === 'exercises') {
          return { data: { id: `ex-${String(ultimo.name ?? '').toLowerCase()}` }, error: null };
        }
        return { data: null, error: null };
      },
    };
    return builder;
  };

  return {
    workouts,
    exercises,
    cardio,
    rpcCalls,
    from,
    rpc,
    failNext: () => {
      failRpc = true;
    },
    loseNextResponse: () => {
      loseNextResponse = true;
    },
    reset: () => {
      workouts.length = 0;
      exercises.length = 0;
      cardio.length = 0;
      rpcCalls.length = 0;
      seq = 0;
      failRpc = false;
      loseNextResponse = false;
    },
  };
});

vi.mock('@shared/lib/supabase', () => ({ supabase: { from: h.from, rpc: h.rpc } }));

vi.mock('@shared/api/queries', () => ({ fetchExercises: vi.fn().mockResolvedValue([]) }));

vi.mock('@features/cardio/stores/cardioStore', () => ({
  CARDIO_LABELS: { run: 'Carrera', bike: 'Bici' },
}));

import { applyExcelImport } from '../applyExcelImport';
import { makeDedupKey } from '../exportImport';
import type { ParsedImport } from '../excelImport';

const parsedCon = (strength: ParsedImport['strength']): ParsedImport => ({
  strength,
  cardio: [],
  routines: [],
});

const parsedConCardio = (cardio: ParsedImport['cardio']): ParsedImport => ({
  strength: [],
  cardio,
  routines: [],
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const setsDelPrimerEntreno = () => h.workouts[0]?.sets ?? [];

describe('applyExcelImport', () => {
  beforeEach(() => {
    h.reset();
  });

  it('reimportar un Excel ya importado no escribe nada ni crea ejercicios', async () => {
    const parsed = parsedCon([
      { date: '2026-01-05', exercise: 'Press banca', reps: 10, weight: 80 },
      { date: '2026-01-05', exercise: 'Press banca', reps: 8, weight: 80 },
    ]);
    const existentes = new Set([
      makeDedupKey('2026-01-05', 'Press banca', 1),
      makeDedupKey('2026-01-05', 'Press banca', 2),
    ]);

    const result = await applyExcelImport('u1', parsed, existentes);

    expect(result).toEqual({ sets: 0, cardio: 0, skipped: 2, failed: 0, importedKeys: [] });
    expect(h.rpcCalls).toHaveLength(0);
    expect(h.workouts).toHaveLength(0);
    expect(h.exercises).toHaveLength(0);
  });

  it('guarda cada fecha en una sola RPC y solo si entra alguna serie', async () => {
    const parsed = parsedCon([
      { date: '2026-01-05', exercise: 'Press banca', reps: 10, weight: 80 },
      { date: '2026-01-05', exercise: 'Sentadilla', reps: 5, weight: 100 },
      // Este día ya está entero en BD: no debe abrir un entreno vacío.
      { date: '2026-01-06', exercise: 'Press banca', reps: 10, weight: 80 },
    ]);
    const existentes = new Set([makeDedupKey('2026-01-06', 'Press banca', 1)]);

    const result = await applyExcelImport('u1', parsed, existentes);

    expect(result.sets).toBe(2);
    expect(result.skipped).toBe(1);
    expect(h.rpcCalls).toHaveLength(1);

    const [call] = h.rpcCalls;
    expect(call?.args).toMatchObject({
      p_user_id: 'u1',
      p_exercise_id: null,
      p_started_at: '2026-01-05',
      p_finished_at: null,
    });
    expect(call?.args.p_client_id).toEqual(expect.any(String));

    expect(h.workouts).toHaveLength(1);
    expect(h.workouts[0]).toMatchObject({ user_id: 'u1', started_at: '2026-01-05' });
    // Cada serie lleva su ejercicio: la RPC no necesita un `p_exercise_id` común.
    expect(setsDelPrimerEntreno()).toMatchObject([
      { exercise_id: 'ex-press banca', set_num: 1, reps: 10, weight: 80 },
      { exercise_id: 'ex-sentadilla', set_num: 1, reps: 5, weight: 100 },
    ]);
  });

  it('el set_num cuenta todas las filas del día, también las que ya existían', async () => {
    const parsed = parsedCon([
      { date: '2026-01-05', exercise: 'Press banca', reps: 10, weight: 80 },
      // La serie 2 ya estaba; la 3 es nueva y tiene que seguir siendo la 3.
      { date: '2026-01-05', exercise: 'Press banca', reps: 8, weight: 80 },
      { date: '2026-01-05', exercise: 'Press banca', reps: 6, weight: 80 },
    ]);
    const existentes = new Set([makeDedupKey('2026-01-05', 'Press banca', 2)]);

    const result = await applyExcelImport('u1', parsed, existentes);

    expect(result.sets).toBe(2);
    expect(result.skipped).toBe(1);
    expect(setsDelPrimerEntreno().map((s) => s.set_num)).toEqual([1, 3]);
    // Solo las claves realmente guardadas: la 2 ya existía y no debe entrar en
    // el set que el hook usa para la siguiente importación.
    expect(result.importedKeys).toEqual([
      makeDedupKey('2026-01-05', 'Press banca', 1),
      makeDedupKey('2026-01-05', 'Press banca', 3),
    ]);
    expect(h.workouts).toHaveLength(1);
  });

  it('un fallo de la RPC no deja el día a medias ni da claves por guardadas', async () => {
    h.failNext();
    const parsed = parsedCon([
      { date: '2026-01-07', exercise: 'Press banca', reps: 10, weight: 80 },
    ]);

    const result = await applyExcelImport('u1', parsed, new Set());

    expect(result.sets).toBe(0);
    expect(result.importedKeys).toEqual([]);
    // Atómico: como la RPC falla, el entreno no existe (no queda vacío).
    expect(h.workouts).toHaveLength(0);
  });

  it('un reintento tras perder la respuesta reutiliza la clave y no duplica', async () => {
    h.loseNextResponse();
    const parsed = parsedCon([
      { date: '2026-01-08', exercise: 'Press banca', reps: 10, weight: 80 },
      { date: '2026-01-08', exercise: 'Press banca', reps: 8, weight: 80 },
    ]);

    const result = await applyExcelImport('u1', parsed, new Set());

    // El primer intento escribió y lanzó un error de red; el segundo encontró
    // el mismo entreno por la clave. Para el usuario es un guardado normal.
    expect(result.sets).toBe(2);
    expect(h.rpcCalls).toHaveLength(2);
    expect(h.rpcCalls[1]?.args.p_client_id).toBe(h.rpcCalls[0]?.args.p_client_id);
    expect(h.workouts).toHaveLength(1);
    expect(setsDelPrimerEntreno()).toHaveLength(2);
  });

  it('sin claves existentes importa todas las filas del fichero', async () => {
    const parsed = parsedCon([
      { date: '2026-01-05', exercise: 'Press banca', reps: 10, weight: 80 },
      { date: '2026-01-05', exercise: 'Press banca', reps: 8, weight: 80 },
    ]);

    const result = await applyExcelImport('u1', parsed);

    expect(result.sets).toBe(2);
    expect(result.skipped).toBe(0);
    expect(setsDelPrimerEntreno().map((s) => s.set_num)).toEqual([1, 2]);
  });

  it('guarda el cardio con una RPC idempotente y una clave derivada de la importación', async () => {
    const importId = '7a4b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d';
    const parsed = parsedConCardio([
      {
        date: '2026-01-09',
        typeLabel: 'Carrera',
        durationMin: 30,
        distanceKm: 5,
        calories: 300,
        notes: 'suave',
      },
    ]);

    const result = await applyExcelImport('u1', parsed, new Set(), importId);

    expect(result).toMatchObject({ sets: 0, cardio: 1, skipped: 0, failed: 0 });
    expect(h.cardio).toHaveLength(1);
    expect(h.rpcCalls).toHaveLength(1);
    const [call] = h.rpcCalls;
    expect(call?.fn).toBe('save_cardio_session');
    expect(call?.args).toMatchObject({
      p_user_id: 'u1',
      p_type: 'run',
      p_started_at: '2026-01-09',
      p_duration: 1800,
      p_distance: 5,
      p_calories: 300,
      p_notes: 'suave',
    });
    expect(String(call?.args.p_client_id)).toMatch(UUID);
  });

  it('un reintento tras perder la respuesta del cardio reutiliza la clave y no duplica', async () => {
    h.loseNextResponse();
    const parsed = parsedConCardio([
      {
        date: '2026-01-10',
        typeLabel: 'Bici',
        durationMin: 20,
        distanceKm: 8,
        calories: null,
        notes: null,
      },
    ]);

    const result = await applyExcelImport('u1', parsed);

    expect(result.cardio).toBe(1);
    expect(result.failed).toBe(0);
    expect(h.rpcCalls).toHaveLength(2);
    expect(h.rpcCalls[1]?.args.p_client_id).toBe(h.rpcCalls[0]?.args.p_client_id);
    expect(h.cardio).toHaveLength(1);
  });

  it('misma clave de cardio con contenido distinto no se cuenta como importada ni se reintenta', async () => {
    const importId = '8b5c2d3e-4f5a-4b6c-8d7e-8f9a0b1c2d3e';
    const primera = parsedConCardio([
      {
        date: '2026-01-11',
        typeLabel: 'Carrera',
        durationMin: 30,
        distanceKm: 5,
        calories: null,
        notes: null,
      },
    ]);
    const segunda = parsedConCardio([
      {
        date: '2026-01-11',
        typeLabel: 'Carrera',
        durationMin: 45,
        distanceKm: 5,
        calories: null,
        notes: null,
      },
    ]);

    await applyExcelImport('u1', primera, new Set(), importId);
    const result = await applyExcelImport('u1', segunda, new Set(), importId);

    expect(result.cardio).toBe(0);
    expect(result.failed).toBe(1);
    // Un conflicto no es un fallo de red: no se reintenta.
    expect(h.rpcCalls).toHaveLength(2);
    expect(h.cardio).toHaveLength(1);
  });

  it('un fallo de cardio no se cuenta como importado', async () => {
    h.failNext();
    const parsed = parsedConCardio([
      {
        date: '2026-01-12',
        typeLabel: 'Carrera',
        durationMin: 30,
        distanceKm: 5,
        calories: null,
        notes: null,
      },
    ]);

    const result = await applyExcelImport('u1', parsed);

    expect(result.cardio).toBe(0);
    expect(result.failed).toBe(1);
    expect(h.cardio).toHaveLength(0);
  });

  it('dos importaciones manuales del mismo día usan claves distintas', async () => {
    const parsed = parsedCon([
      { date: '2026-01-13', exercise: 'Press banca', reps: 10, weight: 80 },
    ]);

    await applyExcelImport('u1', parsed, new Set(), '9c6d3e4f-5a6b-4c7d-8e9f-9a0b1c2d3e4f');
    await applyExcelImport('u1', parsed, new Set(), 'ad7e4f5a-6b7c-4d8e-9f0a-0b1c2d3e4f5a');

    expect(h.rpcCalls).toHaveLength(2);
    expect(h.rpcCalls[0]?.args.p_client_id).not.toBe(h.rpcCalls[1]?.args.p_client_id);
  });
});
