import { describe, it, expect } from 'vitest';
import {
  computeAchievements,
  unlockedIds,
  ACHIEVEMENTS,
  type AchievementInput,
} from '../achievements';

const zero: AchievementInput = {
  totalWorkouts: 0,
  maxStreak: 0,
  totalVolumeKg: 0,
  prCount: 0,
  sessions30d: 0,
};

describe('computeAchievements', () => {
  it('devuelve un estado por cada definición', () => {
    expect(computeAchievements(zero)).toHaveLength(ACHIEVEMENTS.length);
  });

  it('nada desbloqueado con métricas a cero', () => {
    expect(unlockedIds(computeAchievements(zero))).toEqual([]);
  });

  it('desbloquea según umbral', () => {
    const out = computeAchievements({ ...zero, totalWorkouts: 10 });
    const first = out.find((a) => a.id === 'first_workout');
    const ten = out.find((a) => a.id === 'workouts_10');
    const fifty = out.find((a) => a.id === 'workouts_50');
    expect(first?.unlocked).toBe(true);
    expect(ten?.unlocked).toBe(true);
    expect(fifty?.unlocked).toBe(false);
  });

  it('progreso entre 0 y 1', () => {
    const out = computeAchievements({ ...zero, maxStreak: 15 });
    const s7 = out.find((a) => a.id === 'streak_7');
    const s30 = out.find((a) => a.id === 'streak_30');
    expect(s7?.progress).toBe(1);
    expect(s30?.progress).toBeCloseTo(0.5, 2);
  });

  it('volumen alto desbloquea hitos de volumen', () => {
    const ids = unlockedIds(computeAchievements({ ...zero, totalVolumeKg: 120_000 }));
    expect(ids).toContain('volume_10t');
    expect(ids).toContain('volume_100t');
  });
});
