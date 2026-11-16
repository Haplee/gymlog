// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { useProgressionStore } from '../progressionStore';
import type { ProgressionState } from '@shared/lib/progressionCycle';

const pressBanca: ProgressionState = {
  exerciseName: 'Press banca',
  repMin: 8,
  repMax: 12,
  incrementKg: 2.5,
  bodyweight: false,
  currentWeight: 80,
  currentReps: 12,
  sessionCount: 3,
  nextDeloadWeek: 1,
  isDeloadWeek: false,
  updatedAt: '2026-10-28T12:00:00.000Z',
};

beforeEach(() => {
  useProgressionStore.getState().reset();
  useProgressionStore.setState({
    entries: { 'press banca': pressBanca },
    pendingLogs: [],
    fatigueContexts: {},
  });
});

describe('progressionStore con fatiga intra-sesión', () => {
  it('calcula, guarda y devuelve la fatiga aplicada', () => {
    const sessionExercises = [
      { name: 'Press horizontal', muscleGroup: 'Pecho', sets: 2 },
      { name: 'Aperturas', muscleGroup: 'Pecho', sets: 2 },
      { name: 'Press banca', muscleGroup: 'Pecho', sets: 3 },
    ];

    const result = useProgressionStore
      .getState()
      .recordSession(
        'Press banca',
        { weight: 80, reps: 12, sessionReps: [12, 12, 12] },
        { repMin: 8, repMax: 12, incrementKg: 2.5 },
        sessionExercises,
        3,
      );

    expect(result?.fatigueApplied).toBe(0.05);
    expect(result?.currentWeight).toBe(78.5);
    expect(useProgressionStore.getState().fatigueContextFor('Press banca')).toEqual({
      priorSets: 4,
      fatiguePenalty: 0.05,
      sessionCount: 3,
    });
  });
});
