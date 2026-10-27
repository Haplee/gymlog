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

import { useWorkoutStore, repsDeSerie } from '../workoutStore';
import { supabase } from '@shared/lib/supabase';
import { resolveOrCreateExercise } from '@shared/lib/resolveOrCreateExercise';
import { enqueueWorkout } from '@shared/lib/workoutOutbox';

const mockRpc = vi.mocked(supabase.rpc);
const mockResolveExercise = vi.mocked(resolveOrCreateExercise);
const mockEnqueue = vi.mocked(enqueueWorkout);

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
    mockEnqueue.mockClear();
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
    expect(state.sets[0]).toMatchObject({
      reps: '',
      weight: '',
      isWarmup: false,
      completed: false,
    });
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
      expect(result.error?.message).toBe('workout.errors.pick_exercise');
      expect(result.success).toBe(false);
    });

    it('debería rechazar si no hay series válidas', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      const result = await store.saveWorkout('user-1');
      expect(result.error?.message).toBe('workout.errors.no_valid_sets');
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

    it('debería marcar una serie como completada', () => {
      const store = useWorkoutStore.getState();
      store.updateSet(0, { completed: true });
      expect(useWorkoutStore.getState().sets[0].completed).toBe(true);
    });

    it('debería guardar solo las series completadas con onlyCompleted', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });
      store.updateSet(0, { completed: true });
      store.addSet();
      store.updateSet(1, { reps: '8', weight: '90' });

      const result = await store.saveWorkout('user-1', { onlyCompleted: true });

      expect(result.error).toBeNull();
      expect(result.success).toBe(true);
      const pSets = mockRpc.mock.calls[0][1].p_sets as { set_num: number }[];
      expect(pSets).toHaveLength(1);
      expect(pSets[0]).toMatchObject({ set_num: 1, reps: 10, weight: 100 });
    });

    it('debería rechazar onlyCompleted sin series completadas', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });

      const result = await store.saveWorkout('user-1', { onlyCompleted: true });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('workout.errors.no_valid_sets');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('no guarda la serie heredada que la app abre sola', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });
      // Cerrar una serie abre la siguiente heredando peso y reps: esa fila no
      // la ha hecho nadie y no puede acabar en el entreno.
      store.addSet();

      const result = await useWorkoutStore.getState().saveWorkout('user-1');

      expect(result.success).toBe(true);
      const pSets = mockRpc.mock.calls[0][1].p_sets as { set_num: number }[];
      expect(pSets).toHaveLength(1);
    });

    it('guarda la serie heredada en cuanto el usuario la toca', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });
      store.addSet();
      useWorkoutStore.getState().updateSet(1, { reps: '8' });

      const result = await useWorkoutStore.getState().saveWorkout('user-1');

      expect(result.success).toBe(true);
      const pSets = mockRpc.mock.calls[0][1].p_sets as { set_num: number; reps: number }[];
      expect(pSets).toHaveLength(2);
      expect(pSets[1]).toMatchObject({ reps: 8 });
    });

    it('marcar el ✓ no convierte la heredada en una serie propia', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });
      store.addSet();
      // `completed` no es un dato escrito por el usuario: si solo se marca el
      // ✓ sobre la fila heredada, sigue siendo de la app.
      useWorkoutStore.getState().updateSet(1, { completed: true });

      expect(useWorkoutStore.getState().sets[1].autofilled).toBe(true);
    });

    it('reutiliza la clave de idempotencia al reintentar tras un fallo', async () => {
      // Fallo real (no de red): el entreno no se encola y el estado se conserva
      // para reintentar. Ese reintento tiene que llevar la MISMA clave o el
      // servidor no puede saber que es el mismo envío.
      mockRpc.mockRejectedValueOnce(new Error('Database constraint violation'));
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });

      const first = await store.saveWorkout('user-1');
      expect(first.success).toBe(false);

      const second = await useWorkoutStore.getState().saveWorkout('user-1');
      expect(second.success).toBe(true);

      const [primerEnvio, reintento] = mockRpc.mock.calls;
      expect(primerEnvio[1].p_client_id).toBeTruthy();
      expect(reintento[1].p_client_id).toBe(primerEnvio[1].p_client_id);
      // La hora de cierre también forma parte de la huella: si cambiara, el
      // servidor vería otro contenido con la misma clave y lo rechazaría.
      expect(reintento[1].p_finished_at).toBe(primerEnvio[1].p_finished_at);
    });

    it('estrena clave de idempotencia en la sesión siguiente', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });
      await store.saveWorkout('user-1');

      const next = useWorkoutStore.getState();
      next.setActiveExercise('ex-1');
      next.updateSet(0, { reps: '8', weight: '90' });
      await useWorkoutStore.getState().saveWorkout('user-1');

      const [primera, segunda] = mockRpc.mock.calls;
      expect(segunda[1].p_client_id).not.toBe(primera[1].p_client_id);
    });

    it('rechaza la fila con repeticiones no enteras en vez de guardar una serie menos', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });
      store.addSet();
      // Dato viejo persistido: la RPC lo descarta en silencio (su filtro es
      // `^\d+$`). Antes se enviaba igual y el entreno se guardaba sin esa serie;
      // ahora se abre la fila para corregirla.
      store.updateSet(1, { reps: '10.5', weight: '100' });

      const result = await useWorkoutStore.getState().saveWorkout('user-1');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('workout.errors.reps_invalid');
      expect(result.setErrors).toEqual({ 1: 'workout.errors.reps_invalid' });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('guarda una serie de repeticiones sin peso como 0 kg', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      // Gemelos de pie a una pierna: se escriben las reps y no hay lastre. Antes
      // la pantalla la aceptaba y el store la tiraba, así que Guardar respondía
      // «no hay series válidas» sobre una serie recién escrita.
      store.updateSet(0, { reps: '15', weight: '' });

      const result = await store.saveWorkout('user-1');

      expect(result.error).toBeNull();
      expect(result.success).toBe(true);
      const pSets = mockRpc.mock.calls[0][1].p_sets as { reps: number; weight: number }[];
      expect(pSets).toEqual([expect.objectContaining({ set_num: 1, reps: 15, weight: 0 })]);
    });

    it('registra una serie por tiempo sin reps y sin peso', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '', weight: '', durationSeconds: '48' });

      const result = await store.saveWorkout('user-1');

      expect(result.success).toBe(true);
      const pSets = mockRpc.mock.calls[0][1].p_sets as {
        reps: number | null;
        weight: number;
        duration_seconds?: number;
      }[];
      expect(pSets[0]).toMatchObject({ reps: null, weight: 0, duration_seconds: 48 });
    });

    it('rechaza la fila con peso negativo indicando el motivo', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '8', weight: '-5' });

      const result = await store.saveWorkout('user-1');

      expect(result.success).toBe(false);
      expect(result.setErrors).toEqual({ 0: 'workout.errors.weight_negative' });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('estrena clave cuando el contenido cambia tras un fallo duro', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Database constraint violation'));
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });

      const first = await store.saveWorkout('user-1');
      expect(first.success).toBe(false);
      const claveOriginal = useWorkoutStore.getState().clientId;

      // El usuario corrige el peso: la clave anterior identificaría otro
      // contenido y el servidor la rechazaría para siempre.
      useWorkoutStore.getState().updateSet(0, { weight: '90' });
      const second = await useWorkoutStore.getState().saveWorkout('user-1');

      expect(second.success).toBe(true);
      const [primerEnvio, reintento] = mockRpc.mock.calls;
      expect(reintento[1].p_client_id).not.toBe(claveOriginal);
      expect(reintento[1].p_client_id).not.toBe(primerEnvio[1].p_client_id);
    });

    it('al encolar conserva la clave en la entrada del outbox y limpia la sesión', async () => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });

      const result = await store.saveWorkout('user-1');

      expect(result.queued).toBe(true);
      const entrada = mockEnqueue.mock.calls[0][0];
      expect(entrada.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(entrada.finishedAt).toBeTruthy();
      // La sesión se cierra, pero la entrada ya lleva la identidad completa.
      expect(useWorkoutStore.getState().clientId).toBeNull();
      expect(useWorkoutStore.getState().finishedAt).toBeNull();
    });

    it('en modo peso corporal suma el peso vigente al lastre', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '8', weight: '20' });

      await store.saveWorkout('user-1', { bodyweight: true, bodyWeightKg: 80 });

      const pSets = mockRpc.mock.calls[0][1].p_sets as { weight: number }[];
      expect(pSets[0].weight).toBe(100);
    });

    it('el contexto explícito manda sobre el que quedó en el store', async () => {
      const store = useWorkoutStore.getState();
      // El efecto de la pantalla dejó el contexto del ejercicio anterior.
      store.setBodyweightContext(true, 80);
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '60' });

      await store.saveWorkout('user-1', { bodyweight: false, bodyWeightKg: null });

      const pSets = mockRpc.mock.calls[0][1].p_sets as { weight: number }[];
      expect(pSets[0].weight).toBe(60);
    });

    it('al guardar bien también limpia finishedAt y la huella', async () => {
      const store = useWorkoutStore.getState();
      store.setActiveExercise('ex-1');
      store.updateSet(0, { reps: '10', weight: '100' });
      await store.saveWorkout('user-1');

      const state = useWorkoutStore.getState();
      expect(state.finishedAt).toBeNull();
      expect(state.saveFingerprint).toBeNull();
    });
  });

  describe('repsDeSerie', () => {
    it('solo acepta enteros positivos, como el filtro de la RPC', () => {
      expect(repsDeSerie({ reps: '10' })).toBe(10);
      expect(repsDeSerie({ reps: ' 8 ' })).toBe(8);
      expect(repsDeSerie({ reps: '10.5' })).toBeNull();
      expect(repsDeSerie({ reps: '1e3' })).toBeNull();
      expect(repsDeSerie({ reps: '0' })).toBeNull();
      expect(repsDeSerie({ reps: '-5' })).toBeNull();
      expect(repsDeSerie({ reps: '' })).toBeNull();
      expect(repsDeSerie({})).toBeNull();
    });
  });
});
