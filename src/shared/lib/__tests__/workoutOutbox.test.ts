// @vitest-environment jsdom
import 'fake-indexeddb/auto'; // instala IDBRequest, IDBKeyRange, etc. como globales
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { isNetworkError, type OutboxWorkout } from '../workoutOutbox';

// Mock de supabase controlable por test (hoisted para que vi.mock lo vea).
const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: { rpc: rpcMock, from: fromMock },
}));

describe('isNetworkError', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('true cuando navigator está offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(isNetworkError(new Error('cualquier cosa'))).toBe(true);
  });

  it('detecta mensajes típicos de red estando online', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('NetworkError when attempting'))).toBe(true);
    expect(isNetworkError(new Error('request timeout'))).toBe(true);
  });

  it('false para errores no de red estando online', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(isNetworkError(new Error('violates check constraint'))).toBe(false);
    expect(isNetworkError(new Error('unauthorized'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });

  it('false para errores con código SQLSTATE/PGRST aunque el mensaje mencione fetch', () => {
    vi.stubGlobal('navigator', { onLine: true });
    // Respuesta real del servidor: la petición llegó, no es un fallo de red.
    expect(isNetworkError({ code: '23505', message: 'failed to fetch unique row' })).toBe(false);
    expect(isNetworkError({ code: 'PGRST116', message: 'network of results' })).toBe(false);
    // Sin código de servidor (códigos de socket Node, etc.), la heurística
    // por mensaje sigue aplicando.
    expect(isNetworkError(Object.assign(new Error('fetch failed'), { code: 'ECONNREFUSED' }))).toBe(
      true,
    );
  });
});

// Helpers de los tests de persistencia: importan el módulo "fresco" para que su
// dbPromise perezoso se reabra contra el IndexedDB en memoria recién creado.
function makeEntry(overrides: Partial<OutboxWorkout> = {}): OutboxWorkout {
  return {
    id: crypto.randomUUID(),
    userId: 'user-1',
    exerciseId: 'ex-1',
    customExerciseName: '',
    customMuscleGroup: '',
    startedAt: '2026-06-20T10:00:00.000Z',
    finishedAt: '2026-06-20T10:30:00.000Z',
    sets: [
      {
        set_num: 1,
        reps: 5,
        weight: 100,
        is_warmup: false,
        notes: '',
        rpe: '',
        set_type: 'normal',
      },
    ],
    createdAt: '2026-06-20T10:30:00.000Z',
    ...overrides,
  };
}

async function loadOutbox() {
  return import('../workoutOutbox');
}

describe('workoutOutbox — persistencia y flush', () => {
  beforeEach(() => {
    // IndexedDB en memoria nuevo por test => store vacío y aislado.
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.resetModules();
    rpcMock.mockReset();
    fromMock.mockReset();
    vi.stubGlobal('navigator', { onLine: true });
    // Los caminos de error logean via devError/devLog — silenciados para no
    // ensuciar la salida del runner con fallos esperados.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('enqueue persiste y getPending/count lo reflejan', async () => {
    const { enqueueWorkout, getPendingWorkouts, countPendingWorkouts } = await loadOutbox();
    const entry = makeEntry();

    await enqueueWorkout(entry);

    expect(await countPendingWorkouts()).toBe(1);
    const pending = await getPendingWorkouts();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(entry.id);
  });

  it('flush correcto: envía por RPC, borra de la cola y cuenta los sincronizados', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, countPendingWorkouts } = await loadOutbox();
    rpcMock.mockResolvedValue({ error: null });

    await enqueueWorkout(makeEntry());
    await enqueueWorkout(makeEntry());

    const flushed = await flushWorkoutOutbox();

    expect(flushed).toBe(2);
    expect(rpcMock).toHaveBeenCalledWith(
      'save_workout_with_sets',
      expect.objectContaining({
        p_user_id: 'user-1',
        p_exercise_id: 'ex-1',
      }),
    );
    expect(await countPendingWorkouts()).toBe(0);
  });

  // Regresión: `flushWorkoutOutbox` se dispara al arrancar y en el evento
  // `online`, que el navegador puede emitir dos veces seguidas. Sin coalescer,
  // ambas pasadas leen la misma cola y mandan los mismos entrenos.
  it('dos flush concurrentes envían cada entreno una sola vez', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, countPendingWorkouts } = await loadOutbox();
    // RPC lento: garantiza que la segunda llamada entra con la primera en vuelo.
    rpcMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 20)),
    );

    await enqueueWorkout(makeEntry({ id: 'a' }));
    await enqueueWorkout(makeEntry({ id: 'b' }));

    const [uno, dos] = await Promise.all([flushWorkoutOutbox(), flushWorkoutOutbox()]);

    expect(rpcMock).toHaveBeenCalledTimes(2); // 2 entradas, no 4
    expect(uno).toBe(2);
    expect(dos).toBe(2); // la segunda se engancha al mismo flush
    expect(await countPendingWorkouts()).toBe(0);
  });

  it('recoge lo encolado mientras el flush estaba en vuelo', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, countPendingWorkouts } = await loadOutbox();
    rpcMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 20)),
    );

    await enqueueWorkout(makeEntry({ id: 'primera' }));
    const enVuelo = flushWorkoutOutbox();

    // Entra un entreno nuevo y alguien pide otro flush: la pasada extra lo coge.
    await enqueueWorkout(makeEntry({ id: 'tardia' }));
    const segunda = flushWorkoutOutbox();

    await Promise.all([enVuelo, segunda]);

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(await countPendingWorkouts()).toBe(0);
  });

  // Regresión: el servidor solo puede deduplicar si el reenvío trae la misma
  // clave. Sin esto, un RPC que se escribió pero cuya respuesta se perdió acaba
  // grabando el entreno dos veces (sesiones duplicadas en el historial).
  it('envía el id de la entrada como clave de idempotencia, estable entre reintentos', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, getPendingWorkouts } = await loadOutbox();

    // Primer intento: falla por red. La entrada se conserva con su id intacto.
    rpcMock.mockRejectedValueOnce(new Error('Failed to fetch'));
    await enqueueWorkout(makeEntry({ id: 'entrada-estable' }));
    await flushWorkoutOutbox();

    const pending = await getPendingWorkouts();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('entrada-estable');

    // Segundo intento: la misma clave viaja de nuevo, que es lo que permite al
    // servidor reconocer el reenvío en vez de crear un entreno nuevo.
    rpcMock.mockResolvedValue({ error: null });
    pending[0].nextAttemptAt = undefined;
    await enqueueWorkout(pending[0]);
    await flushWorkoutOutbox();

    expect(rpcMock.mock.calls).toHaveLength(2);
    expect(rpcMock.mock.calls.every((c) => c[1].p_client_id === 'entrada-estable')).toBe(true);
  });

  it('error de red: conserva la entrada para reintentar y para el flush', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, countPendingWorkouts } = await loadOutbox();
    rpcMock.mockResolvedValue({ error: new Error('Failed to fetch') });

    await enqueueWorkout(makeEntry());
    const flushed = await flushWorkoutOutbox();

    expect(flushed).toBe(0);
    expect(await countPendingWorkouts()).toBe(1); // se conserva
  });

  it('error de validación (no de red): conserva la entrada, no la borra en silencio', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, countPendingWorkouts, getPendingWorkouts } =
      await loadOutbox();
    rpcMock.mockResolvedValue({ error: new Error('violates check constraint') });

    await enqueueWorkout(makeEntry());
    const flushed = await flushWorkoutOutbox();

    expect(flushed).toBe(0);
    // No se pierde el entreno: se conserva y se reintentará con backoff.
    expect(await countPendingWorkouts()).toBe(1);
    expect((await getPendingWorkouts())[0].retryCount).toBe(1);
  });

  it('entrada inválida sin ejercicio se conserva como fallida sin llamar al RPC', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, countPendingWorkouts, getPendingWorkouts } =
      await loadOutbox();

    await enqueueWorkout(makeEntry({ exerciseId: null, customExerciseName: '' }));
    const flushed = await flushWorkoutOutbox();

    expect(flushed).toBe(0);
    expect(rpcMock).not.toHaveBeenCalled();
    // Irrecuperable, pero no se borra: se marca como fallida.
    expect(await countPendingWorkouts()).toBe(1);
    expect((await getPendingWorkouts())[0].failed).toBe(true);
  });

  it('error de red incrementa retryCount y conserva la entrada', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, getPendingWorkouts } = await loadOutbox();
    rpcMock.mockResolvedValue({ error: new Error('Failed to fetch') });

    await enqueueWorkout(makeEntry({ id: 'retry-1' }));
    await flushWorkoutOutbox();

    const pending = await getPendingWorkouts();
    expect(pending).toHaveLength(1);
    expect(pending[0].retryCount).toBe(1);
  });

  it('tras MAX_RETRIES la entrada se marca como fallida pero se conserva', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, countPendingWorkouts, getPendingWorkouts } =
      await loadOutbox();
    rpcMock.mockResolvedValue({ error: new Error('Failed to fetch') });

    // retryCount 4 => este intento es el 5º (== MAX_RETRIES) y agota los reintentos.
    await enqueueWorkout(makeEntry({ id: 'maxed', retryCount: 4 }));
    const flushed = await flushWorkoutOutbox();

    expect(flushed).toBe(0);
    // No se borra: se conserva marcada como fallida para no perder el entreno.
    expect(await countPendingWorkouts()).toBe(1);
    expect((await getPendingWorkouts())[0].failed).toBe(true);
  });

  it('una entrada fallida no se reintenta y no bloquea a las siguientes', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, countPendingWorkouts } = await loadOutbox();
    // La primera ya está marcada fallida; la segunda debe sincronizar igualmente.
    rpcMock.mockResolvedValue({ error: null });

    await enqueueWorkout(makeEntry({ id: 'ya-fallida', failed: true }));
    await enqueueWorkout(makeEntry({ id: 'ok' }));

    const flushed = await flushWorkoutOutbox();

    expect(flushed).toBe(1); // solo la buena; la fallida se salta sin llamar al RPC
    expect(await countPendingWorkouts()).toBe(1); // queda la fallida conservada
  });

  it('un fallo de red en una entrada no impide procesar las demás (sin break)', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, countPendingWorkouts } = await loadOutbox();
    // Primera falla por red, segunda va bien: la segunda debe sincronizarse igual.
    rpcMock
      .mockResolvedValueOnce({ error: new Error('Failed to fetch') })
      .mockResolvedValueOnce({ error: null });

    await enqueueWorkout(makeEntry({ id: 'falla-red' }));
    await enqueueWorkout(makeEntry({ id: 'sync-ok' }));

    const flushed = await flushWorkoutOutbox();

    expect(flushed).toBe(1); // la segunda sí se sincroniza pese al fallo de la primera
    expect(await countPendingWorkouts()).toBe(1); // queda la de red, con reintento programado
  });
});
