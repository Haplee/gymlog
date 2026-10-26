// @vitest-environment jsdom
// Rehidratación del store de entreno: lo que prueba aquí es que la clave de
// idempotencia sobrevive a un cierre de la app. El outbox tiene su propia cola
// persistida, pero antes del primer RPC la clave vive solo en este store; si se
// perdiera al reabrir, el reintento mandaría una nueva y el servidor no podría
// reconocer que ya escribió ese entreno.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { saveMock } = vi.hoisted(() => ({ saveMock: vi.fn() }));

vi.mock('@shared/lib/saveWorkout', () => ({ saveWorkoutOrQueue: saveMock }));
vi.mock('@shared/stores/outboxStore', () => ({
  useOutboxStore: { getState: () => ({ refresh: vi.fn() }) },
}));
vi.mock('@shared/lib/reminderReconcile', () => ({ reconcileReminders: vi.fn() }));
vi.mock('@shared/lib/prNotification', () => ({ notifyNewRecords: vi.fn() }));
vi.mock('@features/routine/lib/routineReminders', () => ({
  getRoutineReminderDays: vi.fn(() => []),
}));
vi.mock('@app/queryClient', () => ({ queryClient: { setQueryData: vi.fn() } }));

const STORAGE_KEY = 'gymlog-workout';

interface PersistedShape {
  state: Record<string, unknown>;
  version: number;
}

function seedLegacy(patch: Record<string, unknown> = {}) {
  // Un estado guardado por una versión anterior a `clientId`: el campo no
  // existe en el JSON. Tiene que poder rehidratarse sin romper nada.
  const payload: PersistedShape = {
    state: {
      activeExerciseId: 'ex-legacy',
      customExerciseName: '',
      customMuscleGroup: 'Pecho',
      sets: [
        {
          id: 'set-legacy',
          reps: '8',
          weight: '60',
          durationSeconds: '',
          isWarmup: false,
          notes: '',
          rpe: '',
          setType: 'normal',
          completed: false,
          autofilled: false,
        },
      ],
      startedAt: '2026-08-14T10:00:00.000Z',
      sessionNotes: '',
      sessionRating: null,
      ...patch,
    },
    version: 0,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/** Estado tal y como está escrito en disco (no en el búfer del throttle). */
function persisted(): Record<string, unknown> | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as PersistedShape).state : null;
}

/**
 * Carga el store (y el volcado del throttle de esa misma generación de módulos).
 * Tras `vi.resetModules()` los helpers estáticos pertenecen a otra copia del
 * módulo que la del store, así que tienen que importarse juntos.
 */
async function loadStore() {
  const { useWorkoutStore } = await import('../workoutStore');
  const { flushThrottledStorage } = await import('@shared/lib/throttledStorage');
  return { useWorkoutStore, flush: flushThrottledStorage };
}

function rellenarSerieValida(store: { updateSet: (i: number, d: object) => void }) {
  store.updateSet(0, { reps: '8', weight: '60' });
}

describe('workoutStore — la clave de idempotencia sobrevive al reinicio', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    saveMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rehidrata un estado viejo sin clientId sin romperse', async () => {
    seedLegacy();
    const { useWorkoutStore } = await loadStore();

    const state = useWorkoutStore.getState();
    expect(state.activeExerciseId).toBe('ex-legacy');
    expect(state.sets).toHaveLength(1);
    expect(state.startedAt).toBe('2026-08-14T10:00:00.000Z');
    // Sin campo persistido no se inventa nada al cargar: la clave nace en el
    // primer intento de guardado, no en la rehidratación.
    expect(state.clientId).toBeNull();
  });

  it('escribe la clave en disco antes de llamar a la red y la conserva si falla', async () => {
    seedLegacy();
    let claveVistaPorLaRed: string | null = null;
    let claveEnDiscoDuranteLaLlamada: unknown = null;

    saveMock.mockImplementation(async (input: { clientId: string }) => {
      claveVistaPorLaRed = input.clientId;
      claveEnDiscoDuranteLaLlamada = persisted()?.clientId;
      return { status: 'error', error: new Error('Failed to fetch') };
    });

    const { useWorkoutStore, flush } = await loadStore();
    rellenarSerieValida(useWorkoutStore.getState());

    const result = await useWorkoutStore.getState().saveWorkout('user-1');

    expect(result.success).toBe(false);
    expect(claveVistaPorLaRed).toMatch(/^[0-9a-f-]{36}$/);
    // Lo importante: ya estaba en disco *antes* de que la red fallara. Si el
    // proceso muere durante el RPC, no se pierde.
    expect(claveEnDiscoDuranteLaLlamada).toBe(claveVistaPorLaRed);

    flush();
    expect(persisted()?.clientId).toBe(claveVistaPorLaRed);
    expect(useWorkoutStore.getState().clientId).toBe(claveVistaPorLaRed);
  });

  it('tras reiniciar la app el reintento manda la misma clave', async () => {
    seedLegacy();
    saveMock.mockResolvedValue({ status: 'error', error: new Error('Failed to fetch') });

    const primera = await loadStore();
    rellenarSerieValida(primera.useWorkoutStore.getState());
    await primera.useWorkoutStore.getState().saveWorkout('user-1');
    const clave = primera.useWorkoutStore.getState().clientId;
    primera.flush();
    expect(clave).toBeTruthy();

    // Reinicio: módulo nuevo, mismo localStorage. La cola no interviene aquí;
    // es el store el que tiene que recordar la clave del intento a medias.
    vi.resetModules();
    const segunda = await loadStore();
    expect(segunda.useWorkoutStore.getState().clientId).toBe(clave);

    saveMock.mockResolvedValue({ status: 'saved', error: null });
    const reintento = await segunda.useWorkoutStore.getState().saveWorkout('user-1');

    expect(reintento.success).toBe(true);
    expect(saveMock.mock.calls[1][0].clientId).toBe(clave);
  });

  it('un segundo fallo sin reiniciar tampoco estrena clave', async () => {
    seedLegacy();
    saveMock.mockResolvedValue({ status: 'error', error: new Error('Failed to fetch') });

    const { useWorkoutStore } = await loadStore();
    rellenarSerieValida(useWorkoutStore.getState());

    await useWorkoutStore.getState().saveWorkout('user-1');
    await useWorkoutStore.getState().saveWorkout('user-1');

    expect(saveMock).toHaveBeenCalledTimes(2);
    expect(saveMock.mock.calls[1][0].clientId).toBe(saveMock.mock.calls[0][0].clientId);
  });

  it('al guardar bien limpia la clave, en memoria y en disco', async () => {
    seedLegacy();
    saveMock.mockResolvedValue({ status: 'saved', error: null });

    const { useWorkoutStore, flush } = await loadStore();
    rellenarSerieValida(useWorkoutStore.getState());
    const clave = await (async () => {
      await useWorkoutStore.getState().saveWorkout('user-1');
      return saveMock.mock.calls[0][0].clientId as string;
    })();

    expect(useWorkoutStore.getState().clientId).toBeNull();
    flush();
    expect(persisted()?.clientId).toBeNull();

    // Y la sesión siguiente no hereda la clave de la anterior.
    useWorkoutStore.getState().setActiveExercise('ex-2');
    rellenarSerieValida(useWorkoutStore.getState());
    await useWorkoutStore.getState().saveWorkout('user-1');
    expect(saveMock.mock.calls[1][0].clientId).not.toBe(clave);
  });

  it('al encolar también limpia la clave: el outbox ya la lleva en su entrada', async () => {
    seedLegacy();
    saveMock.mockResolvedValue({ status: 'queued', error: null });

    const { useWorkoutStore, flush } = await loadStore();
    rellenarSerieValida(useWorkoutStore.getState());
    const result = await useWorkoutStore.getState().saveWorkout('user-1');

    expect(result.success).toBe(true);
    expect(result.queued).toBe(true);
    expect(useWorkoutStore.getState().clientId).toBeNull();
    flush();
    expect(persisted()?.clientId).toBeNull();
  });
});
