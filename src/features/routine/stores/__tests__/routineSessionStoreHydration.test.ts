// @vitest-environment jsdom
// La sesión de rutina guarda las claves de idempotencia dentro de los ejercicios
// persistidos. Aquí se simula el reinicio de la app: se siembra el
// localStorage con una sesión a medias y se comprueba que el reenvío usa
// exactamente esas claves, tanto por la ruta directa como por el outbox.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { saveMock, enqueueMock } = vi.hoisted(() => ({
  saveMock: vi.fn(),
  enqueueMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@shared/lib/saveWorkout', () => ({ saveWorkoutOrQueue: saveMock }));
vi.mock('@shared/lib/workoutOutbox', () => ({
  enqueueWorkout: enqueueMock,
  isNetworkError: (err: unknown) => err instanceof TypeError,
}));
vi.mock('@shared/stores/outboxStore', () => ({
  useOutboxStore: { getState: () => ({ refresh: vi.fn() }) },
}));

const STORAGE_KEY = 'gymlog-routine-session';

interface SeedExercise {
  name: string;
  clientId?: string;
  sets?: { id: string; reps: string; weight: string; rpe: string; durationSeconds: string }[];
}

function makeSets(id: string) {
  return [{ id, reps: '8', weight: '60', rpe: '', durationSeconds: '' }];
}

function seedSession(exercises: SeedExercise[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      state: {
        routineId: 'rutina-1',
        routineName: 'Mi rutina',
        dayName: 'Día 1 - Empuje',
        day: 'monday',
        startedAt: '2026-08-14T10:00:00.000Z',
        exercises: exercises.map((ex) => ({
          name: ex.name,
          targetSets: 1,
          sets: ex.sets ?? makeSets(`set-${ex.name}`),
          ...(ex.clientId ? { clientId: ex.clientId } : {}),
        })),
      },
      version: 0,
    }),
  );
}

function persistedExercises(): { name: string; clientId?: string }[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return (JSON.parse(raw) as { state: { exercises: { name: string; clientId?: string }[] } }).state
    .exercises;
}

async function loadStore() {
  const { useRoutineSessionStore } = await import('../routineSessionStore');
  return useRoutineSessionStore;
}

const resolveExerciseId = (name: string) => `cat-${name}`;
const identity = (w: number) => w;

describe('routineSessionStore — claves tras reiniciar la app', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    saveMock.mockReset();
    enqueueMock.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('finaliza con las claves que quedaron persistidas antes del cierre', async () => {
    seedSession([
      { name: 'Press banca', clientId: 'cli-banca' },
      { name: 'Press militar', clientId: 'cli-militar' },
    ]);
    const store = await loadStore();
    saveMock.mockResolvedValue({ status: 'saved', error: null });

    const result = await store.getState().finish('user-1', resolveExerciseId, identity);

    expect(result.success).toBe(true);
    expect(saveMock.mock.calls.map((c) => c[0].clientId)).toEqual(['cli-banca', 'cli-militar']);
    // Guardada: la sesión se limpia y una nueva no arrastra estas claves.
    expect(persistedExercises()).toEqual([]);
  });

  it('una sesión antigua sin clientId los recibe y los guarda antes de la red', async () => {
    seedSession([{ name: 'Press banca' }]);
    const store = await loadStore();
    saveMock.mockResolvedValue({ status: 'error', error: new Error('Failed to fetch') });

    const result = await store.getState().finish('user-1', resolveExerciseId, identity);

    expect(result.success).toBe(false);
    const clave = saveMock.mock.calls[0][0].clientId as string;
    expect(clave).toMatch(/^[0-9a-f-]{36}$/);
    // Persistida con la sesión: un cierre durante el RPC no la pierde.
    expect(persistedExercises()[0].clientId).toBe(clave);

    // Reinicio y reintento: la misma clave, no una nueva.
    vi.resetModules();
    const trasReinicio = await loadStore();
    saveMock.mockResolvedValue({ status: 'saved', error: null });
    await trasReinicio.getState().finish('user-1', resolveExerciseId, identity);

    expect(saveMock.mock.calls[1][0].clientId).toBe(clave);
  });

  it('la ruta de outbox encola el resto con su clave persistida', async () => {
    seedSession([
      { name: 'Press banca', clientId: 'cli-banca' },
      { name: 'Press militar', clientId: 'cli-militar' },
    ]);
    const store = await loadStore();
    // El primero no llega al servidor: se encola. El segundo ni se intenta.
    saveMock.mockResolvedValue({ status: 'queued', error: null });

    const result = await store.getState().finish('user-1', resolveExerciseId, identity);

    expect(result.success).toBe(true);
    expect(result.queued).toBe(true);
    expect(saveMock.mock.calls[0][0].clientId).toBe('cli-banca');
    // El corte va en i + 1: el primero ya está encolado y no se repite.
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock.mock.calls[0][0]).toMatchObject({
      id: 'cli-militar',
      exerciseId: 'cat-Press militar',
    });
  });

  it('la sesión siguiente estrena claves, no reutiliza las de la anterior', async () => {
    seedSession([{ name: 'Press banca', clientId: 'cli-vieja' }]);
    const store = await loadStore();
    saveMock.mockResolvedValue({ status: 'saved', error: null });
    await store.getState().finish('user-1', resolveExerciseId, identity);

    const day = { name: 'Día 2', exercises: [{ name: 'Sentadilla', sets: 1, reps: '5' }] };
    store.getState().start({ id: 'rutina-1', name: 'Mi rutina' } as never, 'tuesday', day as never);
    store.getState().updateSet(0, 0, { weight: '60' });
    await store.getState().finish('user-1', resolveExerciseId, identity);

    const nueva = saveMock.mock.calls[1][0].clientId as string;
    expect(nueva).toMatch(/^[0-9a-f-]{36}$/);
    expect(nueva).not.toBe('cli-vieja');
  });
});
