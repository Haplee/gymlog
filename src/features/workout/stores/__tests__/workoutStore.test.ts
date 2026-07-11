import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('@shared/lib/supabase', () => {
  const rpc = vi.fn().mockResolvedValue({ data: { id: 'wo-id' }, error: null });
  const singleFn = vi.fn().mockResolvedValue({ data: { id: 'test-exercise-id' }, error: null });
  const selectFn = vi.fn(() => ({ single: singleFn }));
  const insertFn = vi.fn(() => ({ select: selectFn }));
  const upsertFn = vi.fn().mockResolvedValue({ data: { id: 'test-exercise-id' }, error: null });
  const from = vi.fn(() => ({ insert: insertFn, upsert: upsertFn, select: selectFn }));
  return { supabase: { from, rpc } };
});

vi.mock('@shared/lib/workoutOutbox', () => ({
  enqueueWorkout: vi.fn().mockResolvedValue(undefined),
  isNetworkError: (err: unknown) => err instanceof TypeError,
}));

vi.mock('@shared/stores/outboxStore', () => ({
  useOutboxStore: { getState: () => ({ refresh: vi.fn() }) },
}));

vi.mock('@shared/lib/resolveOrCreateExercise', () => ({
  resolveOrCreateExercise: vi.fn().mockResolvedValue('test-exercise-id'),
}));

import { useWorkoutStore } from '../workoutStore';
import { supabase } from '@shared/lib/supabase';
import { resolveOrCreateExercise } from '@shared/lib/resolveOrCreateExercise';

const mockRpc = vi.mocked(supabase.rpc);
const mockResolveExercise = vi.mocked(resolveOrCreateExercise);

// jsdom no define navigator.onLine → lo fijamos manualmente
const DEFAULT_ONLINE = true;

// Los tests de camino-error logean via devError — silenciado para no ensuciar
// la salida del runner con fallos esperados.
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('useWorkoutStore', () => {
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    useWorkoutStore.getState().clearPersistedState();
    mockRpc.mockClear();
    mockRpc.mockResolvedValue({
      data: { id: 'wo-id' },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
      success: true,
    });
    mockResolveExercise.mockClear();
    mockResolveExercise.mockResolvedValue('test-exercise-id');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: DEFAULT_ONLINE });
  });

  it('debería inicializar con valores por defecto', () => {
    const state = useWorkoutStore.getState();
    expect(state.activeExerciseId).toBeNull();
    expect(state.customExerciseName).toBe('');
    expect(state.sets).toEqual([]);
    expect(state.startedAt).toBeNull();
  });

  it('debería añadir una serie con valores por defecto', () => {
    const { addSet } = useWorkoutStore.getState();
    addSet();
    const state = useWorkoutStore.getState();
    expect(state.sets).toHaveLength(1);
    expect(state.sets[0]).toMatchObject({ reps: '', weight: '', isWarmup: false });
  });

  it('debería añadir una serie copiando la anterior', () => {
    const store = useWorkoutStore.getState();
    store.updateSet(0, { reps: '10', weight: '100' });
    store.addSet();
    const state = useWorkoutStore.getState();
    expect(state.sets).toHaveLength(2);
    expect(state.sets[1]).toMatchObject({ reps: '10', weight: '100', isWarmup: false });
  });

  it('debería actualizar una serie existente', () => {
    const { updateSet } = useWorkoutStore.getState();
    updateSet(0, { reps: '8', weight: '60' });
    const state = useWorkoutStore.getState();
    expect(state.sets[0].reps).toBe('8');
    expect(state.sets[0].weight).toBe('60');
  });

  it('debería eliminar una serie', () => {
    const store = useWorkoutStore.getState();
    store.updateSet(0, { reps: '10', weight: '100' });
    store.addSet();
    store.removeSet(0);
    const state = useWorkoutStore.getState();
    expect(state.sets).toHaveLength(1);
  });

  it('debería eliminar todas las series', () => {
    const store = useWorkoutStore.getState();
    store.addSet();
    store.addSet();
    store.addSet();
    store.removeAllSets();
    const state = useWorkoutStore.getState();
    expect(state.sets).toHaveLength(0);
  });

  it('debería establecer ejercicio activo', () => {
    const { setActiveExercise } = useWorkoutStore.getState();
    setActiveExercise('exercise-123');
    const state = useWorkoutStore.getState();
    expect(state.activeExerciseId).toBe('exercise-123');
    expect(state.startedAt).not.toBeNull();
  });

  it('debería establecer nombre de ejercicio personalizado', () => {
    const { setCustomExerciseName } = useWorkoutStore.getState();
    setCustomExerciseName('Press banca');
    const state = useWorkoutStore.getState();
    expect(state.customExerciseName).toBe('Press banca');
  });

  it('debería limpiar el estado', () => {
    const store = useWorkoutStore.getState();
    store.setActiveExercise('test-id');
    store.updateSet(0, { reps: '10', weight: '100' });
    store.clearPersistedState();
    const state = useWorkoutStore.getState();
    expect(state.activeExerciseId).toBeNull();
    expect(state.customExerciseName).toBe('');
    expect(state.sets).toEqual([]);
    expect(state.startedAt).toBeNull();
  });

  describe('saveWorkout', () => {
    it('debería rechazar si no hay ejercicio activo ni nombre custom', async () => {
      const result = await useWorkoutStore.getState().saveWorkout('user-1');
      expect(result.error?.message).toBe('Selecciona un ejercicio');
      expect(result.success).toBe(false);
    });

    it('debería rechazar si no hay series válidas', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      const result = await store.saveWorkout('user-1');
      expect(result.error?.message).toBe('Añade reps y kg válidas');
      expect(result.success).toBe(false);
    });

    it('debería guardar online y reiniciar estado', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });

      const result = await store.saveWorkout('user-1');

      expect(mockRpc).toHaveBeenCalledOnce();
      expect(mockRpc).toHaveBeenCalledWith(
        'save_workout_with_sets',
        expect.objectContaining({
          p_user_id: 'user-1',
          p_exercise_id: 'ex-1',
        }),
      );
      expect(result.error).toBeNull();
      expect(result.success).toBe(true);
      expect(result.queued).toBeUndefined();
      expect(useWorkoutStore.getState().sets).toEqual([]);
      expect(useWorkoutStore.getState().activeExerciseId).toBeNull();
    });

    it('debería guardar online con notas y rating', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });
      store.setSessionNotes('Gran sesión');
      store.setSessionRating(4);

      const result = await store.saveWorkout('user-1');

      expect(mockRpc).toHaveBeenCalledWith(
        'save_workout_with_sets',
        expect.objectContaining({
          p_notes: 'Gran sesión',
          p_rating: 4,
        }),
      );
      expect(result.error).toBeNull();
      expect(result.success).toBe(true);
      expect(result.queued).toBeUndefined();
    });

    it('debería encolar offline (navigator.onLine = false)', async () => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });
      const result = await store.saveWorkout('user-1');
      expect(result.queued).toBe(true);
      expect(result.error).toBeNull();
      expect(result.success).toBe(true);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('debería encolar offline cuando RPC lanza TypeError', async () => {
      mockRpc.mockRejectedValue(new TypeError('Failed to fetch'));
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });
      const result = await store.saveWorkout('user-1');
      expect(result.queued).toBe(true);
      expect(result.error).toBeNull();
      expect(result.success).toBe(true);
    });

    it('debería devolver error no-red cuando RPC lanza Error normal', async () => {
      mockRpc.mockRejectedValue(new Error('Database constraint violation'));
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });
      const result = await store.saveWorkout('user-1');
      expect(result.queued).toBeUndefined();
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Database constraint violation');
    });

    it('debería crear ejercicio custom si no hay activeExerciseId', async () => {
      const store = useWorkoutStore.getState();
      store.setCustomExerciseName('Press banca');
      store.updateSet(0, { reps: '10', weight: '100' });

      const result = await store.saveWorkout('user-1');

      expect(mockResolveExercise).toHaveBeenCalledWith('user-1', 'Press banca', 'Otro');
      expect(mockRpc).toHaveBeenCalledWith(
        'save_workout_with_sets',
        expect.objectContaining({
          p_exercise_id: 'test-exercise-id',
        }),
      );
      expect(result.error).toBeNull();
      expect(result.success).toBe(true);
    });

    it('debería devolver error si crear ejercicio custom falla', async () => {
      mockResolveExercise.mockRejectedValue(new Error('Insert failed'));
      const store = useWorkoutStore.getState();
      store.setCustomExerciseName('Press banca');
      store.updateSet(0, { reps: '10', weight: '100' });

      const result = await store.saveWorkout('user-1');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Insert failed');
    });

    it('debería reiniciar también notas y rating al guardar', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });
      store.setSessionNotes('Nota de prueba');
      store.setSessionRating(3);

      await store.saveWorkout('user-1');

      const state = useWorkoutStore.getState();
      expect(state.sessionNotes).toBe('');
      expect(state.sessionRating).toBeNull();
    });
  });
});
