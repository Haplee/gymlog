import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  countPendingWorkouts: vi.fn<(userId?: string | null) => Promise<number>>(),
  devError: vi.fn<(message: string, error: unknown) => void>(),
}));

vi.mock('@shared/lib/workoutOutbox', () => ({
  countPendingWorkouts: mocks.countPendingWorkouts,
}));

vi.mock('@shared/lib/devtools', () => ({
  devError: mocks.devError,
}));

import { useOutboxStore } from '../outboxStore';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.countPendingWorkouts.mockResolvedValue(0);
  useOutboxStore.setState({
    pending: 0,
    lastRefreshedAt: 0,
    lastRefreshedUserId: null,
    refreshGeneration: 0,
  });
});

describe('outboxStore', () => {
  it('deja el contador a cero sin consultar IndexedDB cuando no hay usuario', async () => {
    await useOutboxStore.getState().refresh();

    const state = useOutboxStore.getState();
    expect(mocks.countPendingWorkouts).not.toHaveBeenCalled();
    expect(state.pending).toBe(0);
    expect(state.lastRefreshedUserId).toBeNull();
    expect(state.lastRefreshedAt).toBeGreaterThan(0);
    expect(state.refreshGeneration).toBeGreaterThan(0);
  });

  it('refresca el contador de la cuenta indicada', async () => {
    mocks.countPendingWorkouts.mockResolvedValue(3);

    await useOutboxStore.getState().refresh('user-1');

    const state = useOutboxStore.getState();
    expect(mocks.countPendingWorkouts).toHaveBeenCalledWith('user-1');
    expect(state.pending).toBe(3);
    expect(state.lastRefreshedUserId).toBe('user-1');
    expect(state.lastRefreshedAt).toBeGreaterThan(0);
  });

  it('registra el fallo de IndexedDB sin romper la interfaz', async () => {
    const error = new Error('IndexedDB no disponible');
    mocks.countPendingWorkouts.mockRejectedValue(error);
    useOutboxStore.setState({ pending: 5, lastRefreshedUserId: 'user-1' });

    await expect(useOutboxStore.getState().refresh('user-1')).resolves.toBeUndefined();

    expect(mocks.devError).toHaveBeenCalledWith('[outboxStore] refresh failed:', error);
    expect(useOutboxStore.getState().pending).toBe(5);
    expect(useOutboxStore.getState().lastRefreshedUserId).toBe('user-1');
  });

  it('reset limpia el contador sin borrar la cola persistida', () => {
    useOutboxStore.setState({
      pending: 4,
      lastRefreshedAt: 123,
      lastRefreshedUserId: 'user-1',
      refreshGeneration: 2,
    });

    useOutboxStore.getState().reset();

    const state = useOutboxStore.getState();
    expect(state.pending).toBe(0);
    expect(state.lastRefreshedUserId).toBeNull();
    expect(state.lastRefreshedAt).toBe(123);
    expect(state.refreshGeneration).toBeGreaterThan(2);
    expect(mocks.countPendingWorkouts).not.toHaveBeenCalled();
  });

  it('ignora un refresh obsoleto que termina después del vigente', async () => {
    const first = deferred<number>();
    const second = deferred<number>();
    mocks.countPendingWorkouts.mockImplementation((userId) =>
      userId === 'user-1' ? first.promise : second.promise,
    );

    const firstRefresh = useOutboxStore.getState().refresh('user-1');
    const secondRefresh = useOutboxStore.getState().refresh('user-2');

    second.resolve(4);
    await secondRefresh;
    first.resolve(9);
    await firstRefresh;

    const state = useOutboxStore.getState();
    expect(state.pending).toBe(4);
    expect(state.lastRefreshedUserId).toBe('user-2');
  });

  it('no registra el error de un refresh obsoleto', async () => {
    const first = deferred<number>();
    const second = deferred<number>();
    mocks.countPendingWorkouts.mockImplementation((userId) =>
      userId === 'user-1' ? first.promise : second.promise,
    );

    const firstRefresh = useOutboxStore.getState().refresh('user-1');
    const secondRefresh = useOutboxStore.getState().refresh('user-2');

    second.resolve(2);
    await secondRefresh;
    first.reject(new Error('fallo tardío'));
    await firstRefresh;

    expect(mocks.devError).not.toHaveBeenCalled();
    expect(useOutboxStore.getState().pending).toBe(2);
  });
});
