import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('@shared/lib/supabase', () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  return { supabase: { rpc } };
});

vi.mock('@shared/lib/workoutOutbox', () => ({
  enqueueWorkout: vi.fn().mockResolvedValue(undefined),
  isNetworkError: (err: unknown) => err instanceof TypeError,
}));

vi.mock('@shared/stores/outboxStore', () => ({
  useOutboxStore: { getState: () => ({ refresh: vi.fn() }) },
}));

vi.mock('@shared/lib/resolveOrCreateExercise', () => ({
  resolveOrCreateExercise: vi.fn().mockResolvedValue('created-exercise-id'),
}));

import { useRoutineSessionStore } from '../routineSessionStore';
import type { DayRoutine, Routine } from '../routineStore';
import { supabase } from '@shared/lib/supabase';
import { enqueueWorkout } from '@shared/lib/workoutOutbox';
import { resolveOrCreateExercise } from '@shared/lib/resolveOrCreateExercise';

const mockRpc = vi.mocked(supabase.rpc);
const mockEnqueue = vi.mocked(enqueueWorkout);
const mockResolve = vi.mocked(resolveOrCreateExercise);

const identity = (w: number) => w;

const dayRoutine: DayRoutine = {
  name: 'Día 1 - Empuje',
  exercises: [
    { name: 'Press banca', sets: 2, reps: '8-10' },
    { name: 'Press militar', sets: 1, reps: '10' },
  ],
};

const routine = {
  id: 'custom-123',
  name: 'Mi rutina',
  description: '',
  isCustom: true,
  createdAt: new Date().toISOString(),
  days: { monday: dayRoutine },
} as unknown as Routine;

/** Rellena todas las series de un ejercicio con los mismos valores. */
function fillExercise(exIndex: number, reps: string, weight: string) {
  const { exercises, updateSet } = useRoutineSessionStore.getState();
  exercises[exIndex].sets.forEach((_, setIndex) => {
    updateSet(exIndex, setIndex, { reps, weight });
  });
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('useRoutineSessionStore', () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    useRoutineSessionStore.getState().discard();
    mockRpc.mockClear();
    mockRpc.mockResolvedValue({
      data: null,
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);
    mockEnqueue.mockClear();
    mockResolve.mockClear();
    mockResolve.mockResolvedValue('created-exercise-id');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('start crea una fila de serie por cada serie objetivo', () => {
    useRoutineSessionStore.getState().start(routine, 'monday', dayRoutine);
    const { exercises, startedAt } = useRoutineSessionStore.getState();

    expect(startedAt).not.toBeNull();
    expect(exercises).toHaveLength(2);
    expect(exercises[0].sets).toHaveLength(2);
    expect(exercises[1].sets).toHaveLength(1);
  });

  it('setExercises reemplaza la lista y permite rellenar pesos antes de finish', async () => {
    useRoutineSessionStore.getState().start(routine, 'monday', dayRoutine);

    // El flujo de autocompletado rellena el peso recomendado en todas las series.
    const { exercises } = useRoutineSessionStore.getState();
    const prefilled = exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({ ...s, weight: '60' })),
    }));
    useRoutineSessionStore.getState().setExercises(prefilled);

    const result = await useRoutineSessionStore
      .getState()
      .finish('user-1', () => 'catalog-id', identity);

    expect(result.success).toBe(true);
    expect(result.savedExercises).toBe(2);
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc.mock.calls[0][1]).toMatchObject({
      p_sets: [
        { set_num: 1, reps: 8, weight: 60 },
        { set_num: 2, reps: 8, weight: 60 },
      ],
    });
  });

  it('finish guarda un workout por ejercicio realizado y limpia la sesión', async () => {
    useRoutineSessionStore.getState().start(routine, 'monday', dayRoutine);
    fillExercise(0, '10', '60');
    fillExercise(1, '8', '40');

    const result = await useRoutineSessionStore
      .getState()
      .finish('user-1', () => 'catalog-id', identity);

    expect(result.success).toBe(true);
    expect(result.savedExercises).toBe(2);
    expect(mockRpc).toHaveBeenCalledTimes(2);

    const [, firstArgs] = mockRpc.mock.calls[0];
    expect(firstArgs).toMatchObject({
      p_user_id: 'user-1',
      p_exercise_id: 'catalog-id',
      p_sets: [
        { set_num: 1, reps: 10, weight: 60 },
        { set_num: 2, reps: 10, weight: 60 },
      ],
    });

    // Los dos ejercicios comparten started_at → el historial los agrupa como
    // una sola sesión.
    const [, secondArgs] = mockRpc.mock.calls[1];
    expect((secondArgs as { p_started_at: string }).p_started_at).toBe(
      (firstArgs as { p_started_at: string }).p_started_at,
    );

    expect(useRoutineSessionStore.getState().startedAt).toBeNull();
    expect(useRoutineSessionStore.getState().exercises).toHaveLength(0);
  });

  it('ignora los ejercicios sin series rellenadas', async () => {
    useRoutineSessionStore.getState().start(routine, 'monday', dayRoutine);
    fillExercise(0, '10', '60'); // solo el primero

    const result = await useRoutineSessionStore
      .getState()
      .finish('user-1', () => 'catalog-id', identity);

    expect(result.savedExercises).toBe(1);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('crea el ejercicio si el nombre de la rutina no está en el catálogo', async () => {
    useRoutineSessionStore.getState().start(routine, 'monday', dayRoutine);
    fillExercise(0, '10', '60');

    await useRoutineSessionStore.getState().finish('user-1', () => null, identity);

    expect(mockResolve).toHaveBeenCalledWith('user-1', 'Press banca', 'Otro');
    const [, args] = mockRpc.mock.calls[0];
    expect(args).toMatchObject({ p_exercise_id: 'created-exercise-id' });
  });

  it('convierte el peso tecleado a kg antes de guardar', async () => {
    useRoutineSessionStore.getState().start(routine, 'monday', dayRoutine);
    fillExercise(0, '5', '100');

    const lbToKg = (w: number) => w * 0.45359237;
    await useRoutineSessionStore.getState().finish('user-1', () => 'catalog-id', lbToKg);

    const [, args] = mockRpc.mock.calls[0];
    const sets = (args as { p_sets: { weight: number }[] }).p_sets;
    expect(sets[0].weight).toBeCloseTo(45.36, 2);
  });

  it('rechaza la sesión si no hay ninguna serie válida', async () => {
    useRoutineSessionStore.getState().start(routine, 'monday', dayRoutine);

    const result = await useRoutineSessionStore
      .getState()
      .finish('user-1', () => 'catalog-id', identity);

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(mockRpc).not.toHaveBeenCalled();
    // La sesión se conserva para que el usuario pueda corregirla.
    expect(useRoutineSessionStore.getState().exercises).toHaveLength(2);
  });

  it('sin conexión encola la sesión completa en el outbox', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    useRoutineSessionStore.getState().start(routine, 'monday', dayRoutine);
    fillExercise(0, '10', '60');
    fillExercise(1, '8', '40');

    const result = await useRoutineSessionStore
      .getState()
      .finish('user-1', () => 'catalog-id', identity);

    expect(result.queued).toBe(true);
    expect(result.savedExercises).toBe(2);
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(useRoutineSessionStore.getState().startedAt).toBeNull();
  });

  it('si la red cae a mitad, solo encola los ejercicios que faltan', async () => {
    useRoutineSessionStore.getState().start(routine, 'monday', dayRoutine);
    fillExercise(0, '10', '60');
    fillExercise(1, '8', '40');

    // El primer ejercicio se guarda; el segundo revienta por red.
    mockRpc.mockImplementationOnce((() => Promise.resolve({ data: null, error: null })) as never);
    mockRpc.mockImplementationOnce((() =>
      Promise.reject(new TypeError('Failed to fetch'))) as never);

    const result = await useRoutineSessionStore
      .getState()
      .finish('user-1', () => 'catalog-id', identity);

    expect(result.queued).toBe(true);
    // Uno guardado + uno encolado: el ya guardado NO se duplica en el outbox.
    expect(result.savedExercises).toBe(2);
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({ customExerciseName: 'Press militar' });
  });
});

/* --------------------------------------------- registrar por tiempo (f3) --- */

/** Un día con una plancha por tiempo y un press normal. */
const dayConPlancha: DayRoutine = {
  name: 'Core',
  exercises: [
    { name: 'Plancha', sets: 2, mode: 'time', durationSeconds: 45 },
    { name: 'Press banca', sets: 1, reps: '8' },
  ],
};

const rutinaConPlancha = {
  ...routine,
  days: { monday: dayConPlancha },
} as unknown as Routine;

describe('sesión de rutina con series por tiempo', () => {
  beforeEach(() => {
    useRoutineSessionStore.getState().discard();
    mockRpc.mockClear();
    mockRpc.mockResolvedValue({
      data: null,
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);
    mockResolve.mockClear();
    mockResolve.mockResolvedValue('created-exercise-id');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('copia el modo del plan y precarga los segundos, no las repeticiones', () => {
    useRoutineSessionStore.getState().start(rutinaConPlancha, 'monday', dayConPlancha);
    const [plancha, press] = useRoutineSessionStore.getState().exercises;

    expect(plancha.mode).toBe('time');
    expect(plancha.targetDurationSeconds).toBe(45);
    expect(plancha.sets).toHaveLength(2);
    for (const s of plancha.sets) {
      expect(s.durationSeconds).toBe('45');
      // Vacío a propósito: `targetReps` de un ejercicio por tiempo puede traer
      // un «30-45s» escrito a mano, y tomarlo por repeticiones sería inventarse
      // un 30 que nadie hizo.
      expect(s.reps).toBe('');
    }

    expect(press.mode).toBeUndefined();
    expect(press.sets[0].reps).toBe('8');
    expect(press.sets[0].durationSeconds).toBe('');
  });

  it('guarda una plancha sin peso: reps null y duration_seconds con el tiempo', async () => {
    useRoutineSessionStore.getState().start(rutinaConPlancha, 'monday', dayConPlancha);
    useRoutineSessionStore.getState().updateSet(0, 0, { durationSeconds: '52' });
    useRoutineSessionStore.getState().updateSet(0, 1, { durationSeconds: '38' });

    const result = await useRoutineSessionStore
      .getState()
      .finish('u1', () => 'ex-plancha', identity);
    expect(result.error).toBeNull();

    const llamada = mockRpc.mock.calls.find(
      (c) => (c[1] as { p_exercise_id?: string })?.p_exercise_id === 'ex-plancha',
    );
    expect(llamada).toBeDefined();
    const sets = (llamada?.[1] as { p_sets: Record<string, unknown>[] }).p_sets;

    expect(sets).toHaveLength(2);
    // `null`, no `0`: es lo que separa «no se mide así» de «hizo cero», y lo que
    // el CHECK `workout_sets_measured` de la BD espera ver.
    expect(sets[0].reps).toBeNull();
    expect(sets[0].duration_seconds).toBe(52);
    expect(sets[1].duration_seconds).toBe(38);
    expect(sets[0].weight).toBe(0);
  });

  it('una serie de repeticiones sigue guardándose sin duration_seconds', async () => {
    useRoutineSessionStore.getState().start(rutinaConPlancha, 'monday', dayConPlancha);
    fillExercise(1, '8', '80');

    await useRoutineSessionStore.getState().finish('u1', (n) => `ex-${n}`, identity);

    const llamada = mockRpc.mock.calls.find(
      (c) => (c[1] as { p_exercise_id?: string })?.p_exercise_id === 'ex-Press banca',
    );
    const sets = (llamada?.[1] as { p_sets: Record<string, unknown>[] }).p_sets;

    expect(sets[0].reps).toBe(8);
    expect(sets[0]).not.toHaveProperty('duration_seconds');
  });

  it('una serie sin tiempo y sin reps no se guarda', async () => {
    useRoutineSessionStore.getState().start(rutinaConPlancha, 'monday', dayConPlancha);
    useRoutineSessionStore.getState().updateSet(0, 0, { durationSeconds: '' });
    useRoutineSessionStore.getState().updateSet(0, 1, { durationSeconds: '30' });

    await useRoutineSessionStore.getState().finish('u1', () => 'ex-plancha', identity);

    const llamada = mockRpc.mock.calls.find(
      (c) => (c[1] as { p_exercise_id?: string })?.p_exercise_id === 'ex-plancha',
    );
    const sets = (llamada?.[1] as { p_sets: Record<string, unknown>[] }).p_sets;
    expect(sets).toHaveLength(1);
    expect(sets[0].duration_seconds).toBe(30);
  });

  it('una duración absurda se descarta como si no estuviera', async () => {
    useRoutineSessionStore.getState().start(rutinaConPlancha, 'monday', dayConPlancha);
    // Más de una hora aguantando una plancha es un dedo resbalando en el teclado
    // numérico, no un récord.
    useRoutineSessionStore.getState().updateSet(0, 0, { durationSeconds: '99999' });
    useRoutineSessionStore.getState().updateSet(0, 1, { durationSeconds: '40' });

    await useRoutineSessionStore.getState().finish('u1', () => 'ex-plancha', identity);

    const llamada = mockRpc.mock.calls.find(
      (c) => (c[1] as { p_exercise_id?: string })?.p_exercise_id === 'ex-plancha',
    );
    const sets = (llamada?.[1] as { p_sets: Record<string, unknown>[] }).p_sets;
    expect(sets).toHaveLength(1);
    expect(sets[0].duration_seconds).toBe(40);
  });
});
