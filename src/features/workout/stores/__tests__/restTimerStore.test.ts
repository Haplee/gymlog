import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';

// Mock dependencies
vi.mock('@shared/lib/notifications', () => ({
  scheduleTimerNotification: vi.fn(),
  cancelTimerNotification: vi.fn(),
}));

vi.mock('@shared/lib/alarm', () => ({
  startAlarm: vi.fn(),
  stopAlarm: vi.fn(),
}));

// Mutable state for settingsStore mock
let settingsState = {
  restDuration: 90,
  restByExercise: true,
  restDurations: {},
  restBySet: {},
  sound: true,
};

vi.mock('@shared/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(() => settingsState),
    setState: vi.fn((partial: Partial<typeof settingsState>) => {
      settingsState = { ...settingsState, ...partial };
    }),
  },
}));

// Import after mocks
import { useRestTimerStore } from '../restTimerStore';

describe('restTimerStore - startForExercise', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset settings state
    settingsState = {
      restDuration: 90,
      restByExercise: true,
      restDurations: {},
      restBySet: {},
      sound: true,
    };
    useRestTimerStore.setState({
      endTime: null,
      duration: 90,
      isRunning: false,
      alarmRinging: false,
      currentExerciseId: null,
      currentSetIndex: null,
    });
  });

  it('usa descanso por serie cuando existe restBySet para el ejercicio y serie', () => {
    const { startForExercise } = useRestTimerStore.getState();

    // Configurar descanso por serie: ejercicio 'ex-1', serie 0 = 45s, serie 1 = 60s
    settingsState = {
      ...settingsState,
      restBySet: { 'ex-1': [45, 60] },
      restDurations: {},
      restDuration: 90,
      restByExercise: true,
    };

    act(() => {
      startForExercise('ex-1', 1); // Serie 1 (índice 1) = 60s
    });

    const state = useRestTimerStore.getState();
    expect(state.duration).toBe(60);
    expect(state.currentExerciseId).toBe('ex-1');
    expect(state.currentSetIndex).toBe(1);
    expect(state.isRunning).toBe(true);
  });

  it('usa descanso por ejercicio cuando no hay por serie pero sí por ejercicio', () => {
    const { startForExercise } = useRestTimerStore.getState();

    settingsState = {
      ...settingsState,
      restBySet: {},
      restDurations: { 'ex-2': 120 },
      restDuration: 90,
      restByExercise: true,
    };

    act(() => {
      startForExercise('ex-2', 0);
    });

    const state = useRestTimerStore.getState();
    expect(state.duration).toBe(120);
    expect(state.currentExerciseId).toBe('ex-2');
  });

  it('usa descanso global como fallback cuando no hay configuración específica', () => {
    const { startForExercise } = useRestTimerStore.getState();

    settingsState = {
      ...settingsState,
      restBySet: {},
      restDurations: {},
      restDuration: 180,
      restByExercise: false,
    };

    act(() => {
      startForExercise('ex-3', 0);
    });

    const state = useRestTimerStore.getState();
    expect(state.duration).toBe(180);
    expect(state.currentExerciseId).toBe('ex-3');
  });

  it('respeta restByExercise=false y usa descanso global si no hay restBySet', () => {
    const { startForExercise } = useRestTimerStore.getState();

    // Sin restBySet, con restByExercise=false, debe usar el global
    settingsState = {
      ...settingsState,
      restBySet: {},
      restDurations: { 'ex-4': 60 },
      restDuration: 90,
      restByExercise: false, // Desactivado
    };

    act(() => {
      startForExercise('ex-4', 0);
    });

    const state = useRestTimerStore.getState();
    // restByExercise=false ignora restDurations, usa restDuration global
    expect(state.duration).toBe(90);
  });
});
