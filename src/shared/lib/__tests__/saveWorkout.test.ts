// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type * as WorkoutOutbox from '../workoutOutbox';

type WorkoutOutboxModule = typeof WorkoutOutbox;

const { rpcMock, enqueueMock, resolveMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  enqueueMock: vi.fn().mockResolvedValue(undefined),
  resolveMock: vi.fn(),
}));

vi.mock('../supabase', () => ({ supabase: { rpc: rpcMock } }));
vi.mock('../resolveOrCreateExercise', () => ({ resolveOrCreateExercise: resolveMock }));
vi.mock('../workoutOutbox', async () => {
  // `isNetworkError` es la heurística real: mockearla escondería justo lo que
  // decide si un fallo se encola o se reporta.
  const real = await vi.importActual<WorkoutOutboxModule>('../workoutOutbox');
  return { ...real, enqueueWorkout: enqueueMock };
});

import { saveWorkoutOrQueue } from '../saveWorkout';

const INPUT = {
  clientId: 'cli-1',
  userId: 'u1',
  exerciseId: 'ex-1',
  customExerciseName: '',
  customMuscleGroup: 'Pierna',
  startedAt: '2026-08-14T10:00:00.000Z',
  finishedAt: '2026-08-14T11:00:00.000Z',
  sets: [
    { set_num: 1, reps: 5, weight: 120, is_warmup: false, notes: '', rpe: '', set_type: 'normal' },
  ],
};

describe('saveWorkoutOrQueue', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    enqueueMock.mockClear();
    resolveMock.mockReset();
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('guarda y manda la clave de idempotencia', async () => {
    rpcMock.mockResolvedValue({ error: null });

    await expect(saveWorkoutOrQueue(INPUT)).resolves.toEqual({ status: 'saved' });
    expect(rpcMock).toHaveBeenCalledWith(
      'save_workout_with_sets',
      expect.objectContaining({ p_client_id: 'cli-1', p_exercise_id: 'ex-1' }),
    );
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('sin conexión encola sin gastar el intento', async () => {
    vi.stubGlobal('navigator', { onLine: false });

    await expect(saveWorkoutOrQueue(INPUT)).resolves.toEqual({ status: 'queued' });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'cli-1' }));
  });

  it('un fallo de red encola en vez de perder el entreno', async () => {
    rpcMock.mockRejectedValue(new Error('Failed to fetch'));

    await expect(saveWorkoutOrQueue(INPUT)).resolves.toEqual({ status: 'queued' });
    // Misma clave que el intento fallido: el reenvío no puede duplicar.
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'cli-1' }));
  });

  it('un error del servidor se reporta y NO se encola', async () => {
    // Con código SQLSTATE la petición llegó: reintentar no arreglaría nada y
    // encolar dejaría una entrada que va a fallar para siempre.
    rpcMock.mockResolvedValue({ error: { code: '23514', message: 'violates check constraint' } });

    const outcome = await saveWorkoutOrQueue(INPUT);

    expect(outcome.status).toBe('error');
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('resuelve el ejercicio por nombre cuando no viene id', async () => {
    resolveMock.mockResolvedValue('ex-creado');
    rpcMock.mockResolvedValue({ error: null });

    await saveWorkoutOrQueue({ ...INPUT, exerciseId: null, customExerciseName: 'Curl nórdico' });

    expect(resolveMock).toHaveBeenCalledWith('u1', 'Curl nórdico', 'Pierna');
    expect(rpcMock).toHaveBeenCalledWith(
      'save_workout_with_sets',
      expect.objectContaining({ p_exercise_id: 'ex-creado' }),
    );
  });

  it('sin ejercicio ni nombre resoluble devuelve error', async () => {
    const outcome = await saveWorkoutOrQueue({
      ...INPUT,
      exerciseId: null,
      customExerciseName: '   ',
    });

    expect(outcome).toEqual({ status: 'error', error: new Error('Selecciona un ejercicio') });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
