import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';

// Mock dependencies - must be at top level
vi.mock('@shared/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

vi.mock('@shared/lib/devtools', () => ({
  devError: vi.fn(),
  devLog: vi.fn(),
}));

// Mock workoutStore with functions we can track
const mockClearPersistedState = vi.fn();
const mockSetSets = vi.fn();

vi.mock('@features/workout/stores/workoutStore', () => ({
  useWorkoutStore: {
    getState: vi.fn(() => ({
      clearPersistedState: mockClearPersistedState,
      setSets: mockSetSets,
    })),
  },
}));

// Mock routineSessionStore with function we can track
const mockRoutineSessionStart = vi.fn();

vi.mock('@features/routine/stores/routineSessionStore', () => ({
  useRoutineSessionStore: {
    getState: vi.fn(() => ({
      start: mockRoutineSessionStart,
    })),
  },
}));

describe('routineStore - startWorkoutFromRoutine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function setupStore() {
    const { useRoutineStore: store } = await import('../routineStore');
    store.setState({
      routines: [
        {
          id: 'routine-test-1',
          name: 'Test Routine',
          description: '',
          isCustom: true,
          createdAt: new Date().toISOString(),
          days: {
            monday: {
              name: 'Lunes',
              exercises: [
                {
                  name: 'Press Banca',
                  sets: 3,
                  reps: '8',
                  load_type: 'external',
                },
                {
                  name: 'Sentadilla',
                  sets: 4,
                  reps: '6',
                  load_type: 'external',
                },
              ],
            },
            tuesday: { name: 'Martes', exercises: [] },
            wednesday: { name: 'Miércoles', exercises: [] },
            thursday: { name: 'Jueves', exercises: [] },
            friday: { name: 'Viernes', exercises: [] },
            saturday: { name: 'Sábado', exercises: [] },
            sunday: { name: 'Domingo', exercises: [] },
          },
        },
      ],
      activeRoutineId: null,
    });
    return store;
  }

  it('clona profundamente el día de la rutina con nuevos UUIDs', async () => {
    const store = await setupStore();

    await act(async () => {
      store.getState().startWorkoutFromRoutine('routine-test-1', 'monday');
    });

    // Verificar que workoutStore.setSets fue llamado con series clonadas
    expect(mockSetSets).toHaveBeenCalled();

    const calledSets = mockSetSets.mock.calls[0][0];
    // 3 series de Press Banca + 4 series de Sentadilla = 7 series
    expect(calledSets).toHaveLength(7);

    // Verificar que cada serie tiene ID único
    const ids = calledSets.map((s: { id: string }) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // Todos únicos

    // Verificar flags reseteados
    calledSets.forEach(
      (s: {
        completed: boolean;
        rpe: string;
        rir: string;
        notes: string;
        autofilled: boolean;
        id: string;
      }) => {
        expect(s.completed).toBe(false);
        expect(s.rpe).toBe('');
        expect(s.rir).toBe('');
        expect(s.notes).toBe('');
        expect(s.autofilled).toBe(false);
        expect(s.id).toBeDefined();
        expect(typeof s.id).toBe('string');
        expect(s.id.length).toBeGreaterThan(10); // UUID
      },
    );
  });

  it('no muta la rutina original', async () => {
    const store = await setupStore();

    const originalExercise = store.getState().routines[0].days.monday.exercises[0];
    const originalSets = JSON.parse(JSON.stringify(originalExercise.sets)); // Deep clone for comparison

    // Llamar a startWorkoutFromRoutine
    await act(async () => {
      store.getState().startWorkoutFromRoutine('routine-test-1', 'monday');
    });

    // Verificar que la rutina original no se mutó
    const afterExercise = store.getState().routines[0].days.monday.exercises[0];
    expect(afterExercise.sets).toEqual(originalSets);
  });

  it('limpia estado previo de workoutStore', async () => {
    const store = await setupStore();

    await act(async () => {
      store.getState().startWorkoutFromRoutine('routine-test-1', 'monday');
    });

    expect(mockClearPersistedState).toHaveBeenCalled();
    expect(mockSetSets).toHaveBeenCalled();
  });

  it('sincroniza routineSessionStore.start', async () => {
    const store = await setupStore();

    await act(async () => {
      store.getState().startWorkoutFromRoutine('routine-test-1', 'monday');
    });

    expect(mockRoutineSessionStart).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'routine-test-1' }),
      'monday',
      expect.any(Object),
    );
  });

  it('activa la rutina si no estaba activa', async () => {
    const store = await setupStore();

    // Reset activeRoutineId to null for this test
    store.setState({ activeRoutineId: null });

    await act(async () => {
      store.getState().startWorkoutFromRoutine('routine-test-1', 'monday');
    });

    expect(store.getState().activeRoutineId).toBe('routine-test-1');
  });
});
