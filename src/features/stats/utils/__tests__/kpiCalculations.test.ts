import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  calculateCurrentStreak,
  calculateMaxStreak,
  calculateWeeklyVolume,
  calculateVolumeChangePercent,
  isWorkingSet,
} from '../kpiCalculations';
import type { WorkoutWithSets } from '@shared/lib/types';

const workout = (startedAt: string): WorkoutWithSets =>
  ({ started_at: startedAt }) as WorkoutWithSets;

// Fecha local de referencia: miércoles 10 junio 2026, 12:00 local
const NOW = new Date(2026, 5, 10, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('calculateCurrentStreak', () => {
  it('cuenta racha anclada en hoy', () => {
    const workouts = [
      workout(new Date(2026, 5, 10, 9, 0).toISOString()),
      workout(new Date(2026, 5, 9, 9, 0).toISOString()),
      workout(new Date(2026, 5, 8, 9, 0).toISOString()),
    ];
    expect(calculateCurrentStreak(workouts)).toBe(3);
  });

  it('racha sigue viva si entrenó ayer pero no hoy', () => {
    const workouts = [
      workout(new Date(2026, 5, 9, 9, 0).toISOString()),
      workout(new Date(2026, 5, 8, 9, 0).toISOString()),
    ];
    expect(calculateCurrentStreak(workouts)).toBe(2);
  });

  it('racha rota con hueco de 2 días', () => {
    const workouts = [workout(new Date(2026, 5, 7, 9, 0).toISOString())];
    expect(calculateCurrentStreak(workouts)).toBe(0);
  });

  it('regresión timezone: entreno de anoche 23:30 local cuenta como ayer aunque en UTC sea otro día', () => {
    // Sistema a las 00:30 local del día 10
    vi.setSystemTime(new Date(2026, 5, 10, 0, 30));
    // Entreno ayer (día 9) a las 23:30 local. Con bucketing UTC (toISOString)
    // en zonas UTC+ este entreno saltaba al día 10 o, en UTC-, al día 8.
    const workouts = [workout(new Date(2026, 5, 9, 23, 30).toISOString())];
    expect(calculateCurrentStreak(workouts)).toBe(1);
  });

  it('lista vacía devuelve 0', () => {
    expect(calculateCurrentStreak([])).toBe(0);
  });
});

describe('calculateMaxStreak', () => {
  it('encuentra la racha más larga histórica', () => {
    const workouts = [
      workout(new Date(2026, 4, 1, 9, 0).toISOString()),
      workout(new Date(2026, 4, 2, 9, 0).toISOString()),
      workout(new Date(2026, 4, 3, 9, 0).toISOString()),
      workout(new Date(2026, 4, 10, 9, 0).toISOString()),
      workout(new Date(2026, 4, 11, 9, 0).toISOString()),
    ];
    expect(calculateMaxStreak(workouts)).toBe(3);
  });
});

describe('isWorkingSet', () => {
  it('excluye calentamientos', () => {
    expect(isWorkingSet({ is_warmup: true })).toBe(false);
    expect(isWorkingSet({ is_warmup: false })).toBe(true);
    expect(isWorkingSet({ is_warmup: null })).toBe(true);
    expect(isWorkingSet({})).toBe(true);
  });
});

describe('calculateWeeklyVolume', () => {
  // NOW es miércoles 10 junio 2026 → semana empieza lunes 8 junio 00:00 local
  const set = (startedAt: Date, weight: number, reps: number, isWarmup = false) => ({
    weight,
    reps,
    is_warmup: isWarmup,
    workout: { started_at: startedAt.toISOString() },
  });

  it('suma solo series efectivas de esta semana', () => {
    const sets = [
      set(new Date(2026, 5, 9, 10, 0), 100, 5), // martes: 500
      set(new Date(2026, 5, 8, 10, 0), 50, 10), // lunes: 500
    ];
    expect(calculateWeeklyVolume(sets)).toBe(1000);
  });

  it('excluye calentamientos', () => {
    const sets = [
      set(new Date(2026, 5, 9, 10, 0), 100, 5),
      set(new Date(2026, 5, 9, 10, 0), 200, 10, true), // warmup, fuera
    ];
    expect(calculateWeeklyVolume(sets)).toBe(500);
  });

  it('límite de semana: domingo 23:59 fuera, lunes 00:01 dentro (hora local)', () => {
    const sets = [
      set(new Date(2026, 5, 7, 23, 59), 100, 5), // domingo noche, fuera
      set(new Date(2026, 5, 8, 0, 1), 100, 5), // lunes 00:01, dentro
    ];
    expect(calculateWeeklyVolume(sets)).toBe(500);
  });
});

describe('calculateVolumeChangePercent', () => {
  it('previo 0 y actual >0 → 100%', () => {
    expect(calculateVolumeChangePercent(500, 0)).toBe(100);
  });

  it('previo 0 y actual 0 → 0%', () => {
    expect(calculateVolumeChangePercent(0, 0)).toBe(0);
  });

  it('cálculo normal redondeado', () => {
    expect(calculateVolumeChangePercent(1100, 1000)).toBe(10);
    expect(calculateVolumeChangePercent(900, 1000)).toBe(-10);
  });
});
