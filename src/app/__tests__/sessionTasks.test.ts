// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runSignOutPhase } from '@shared/lib/sessionLifecycle';

const mocks = vi.hoisted(() => ({
  unregisterPushToken: vi.fn(async () => undefined),
  removeClient: vi.fn(async () => undefined),
  saveRoutine: vi.fn(async () => true),
  saveProgression: vi.fn(async () => true),
  clearWorkout: vi.fn(),
}));

vi.mock('@shared/lib/push', () => ({ unregisterPushToken: mocks.unregisterPushToken }));
vi.mock('@app/queryPersister', () => ({ idbPersister: { removeClient: mocks.removeClient } }));
vi.mock('@features/routine/stores/routineStore', () => ({
  useRoutineStore: { getState: () => ({ saveToDb: mocks.saveRoutine }) },
}));
vi.mock('@features/routine/stores/progressionStore', () => ({
  useProgressionStore: { getState: () => ({ saveToDb: mocks.saveProgression }) },
}));
vi.mock('@features/workout/stores/workoutStore', () => ({
  useWorkoutStore: { getState: () => ({ clearPersistedState: mocks.clearWorkout }) },
}));

// Registra las tareas una sola vez, como hace `main.tsx` al arrancar.
await import('@app/sessionTasks');

const cachesMock = {
  keys: vi.fn(async () => ['api', 'assets']),
  delete: vi.fn(async () => true),
};

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as unknown as { caches: typeof cachesMock }).caches = cachesMock;
});

describe('tareas de cierre de sesión', () => {
  it('con usuario: respalda rutinas y progresión y borra el token push', async () => {
    await runSignOutPhase('pre-signout', 'user-1');

    expect(mocks.saveRoutine).toHaveBeenCalledWith('user-1');
    expect(mocks.saveProgression).toHaveBeenCalledWith('user-1');
    expect(mocks.unregisterPushToken).toHaveBeenCalledWith('user-1');
  });

  it('sin usuario: no intenta escribir en el servidor', async () => {
    await runSignOutPhase('pre-signout', null);

    expect(mocks.saveRoutine).not.toHaveBeenCalled();
    expect(mocks.saveProgression).not.toHaveBeenCalled();
    expect(mocks.unregisterPushToken).not.toHaveBeenCalled();
  });

  it('cleanup: borra el entreno en curso, la caché de consultas y la del service worker', async () => {
    await runSignOutPhase('cleanup', null);

    expect(mocks.clearWorkout).toHaveBeenCalledTimes(1);
    expect(mocks.removeClient).toHaveBeenCalledTimes(1);
    expect(cachesMock.keys).toHaveBeenCalledTimes(1);
    expect(cachesMock.delete).toHaveBeenCalledWith('api');
    expect(cachesMock.delete).toHaveBeenCalledWith('assets');
  });

  it('un fallo en una tarea no impide las siguientes', async () => {
    mocks.saveRoutine.mockRejectedValueOnce(new Error('sin red'));

    await expect(runSignOutPhase('pre-signout', 'user-1')).resolves.toBeUndefined();

    expect(mocks.saveProgression).toHaveBeenCalledWith('user-1');
    expect(mocks.unregisterPushToken).toHaveBeenCalledWith('user-1');
  });
});
