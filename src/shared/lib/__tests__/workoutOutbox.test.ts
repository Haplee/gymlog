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
  });

  afterEach(() => {
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

  it('error de red: conserva la entrada para reintentar y para el flush', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, countPendingWorkouts } = await loadOutbox();
    rpcMock.mockResolvedValue({ error: new Error('Failed to fetch') });

    await enqueueWorkout(makeEntry());
    const flushed = await flushWorkoutOutbox();

    expect(flushed).toBe(0);
    expect(await countPendingWorkouts()).toBe(1); // se conserva
  });

  it('error de validación (no de red): descarta la entrada para no atascar la cola', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, countPendingWorkouts } = await loadOutbox();
    rpcMock.mockResolvedValue({ error: new Error('violates check constraint') });

    await enqueueWorkout(makeEntry());
    const flushed = await flushWorkoutOutbox();

    expect(flushed).toBe(0);
    expect(await countPendingWorkouts()).toBe(0); // descartada
  });

  it('entrada inválida sin ejercicio se descarta sin llamar al RPC', async () => {
    const { enqueueWorkout, flushWorkoutOutbox, countPendingWorkouts } = await loadOutbox();

    await enqueueWorkout(makeEntry({ exerciseId: null, customExerciseName: '' }));
    const flushed = await flushWorkoutOutbox();

    expect(flushed).toBe(0);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(await countPendingWorkouts()).toBe(0);
  });
});
