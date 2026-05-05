import { beforeEach, describe, it, expect, vi } from 'vitest';
import { useWorkoutStore } from '../workoutStore';

vi.mock('@shared/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: [{ id: 'test-wo-id' }], error: null }),
      upsert: vi.fn().mockResolvedValue({ data: { id: 'test-exercise-id' }, error: null }),
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'test-exercise-id' }, error: null }),
      }),
    })),
  },
}));

describe('useWorkoutStore', () => {
  beforeEach(() => {
    useWorkoutStore.getState().clearPersistedState();
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
});
