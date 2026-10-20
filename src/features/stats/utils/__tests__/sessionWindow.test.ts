import { describe, it, expect } from 'vitest';
import { toSessionWindow } from '../sessionWindow';

interface SetLike {
  weight: number;
  reps: number;
  rir?: number | null;
  rpe?: number | null;
  is_warmup?: boolean | null;
  exercise?: { name?: string; muscle_group?: string } | null;
  workout?: { started_at: string | null } | null;
}

const set = (started_at: string, weight: number, reps: number, is_warmup = false): SetLike => ({
  weight,
  reps,
  is_warmup,
  exercise: { name: 'Press banca', muscle_group: 'pecho' },
  workout: { started_at },
});

describe('toSessionWindow', () => {
  it('agrupa por día local (no UTC)', () => {
    const sets: SetLike[] = [
      set('2026-10-19T10:00:00+02:00', 80, 8),
      set('2026-10-19T22:00:00+02:00', 82.5, 6),
    ];
    const sessions = toSessionWindow(sets);
    expect(sessions.length).toBe(1);
  });

  it('excluye calentamientos', () => {
    const sets: SetLike[] = [
      set('2026-10-19T10:00:00Z', 40, 10, true),
      set('2026-10-19T10:00:00Z', 80, 8, false),
    ];
    const sessions = toSessionWindow(sets);
    expect(sessions[0].sets.length).toBe(1);
  });

  it('limita a EXERCISE_SESSION_LIMIT (8) y devuelve las más recientes', () => {
    const sets: SetLike[] = [];
    for (let i = 10; i >= 0; i--) {
      const day = i + 1;
      const month = 10;
      const dateStr = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T10:00:00Z`;
      sets.push(set(dateStr, 80, 8));
    }
    const sessions = toSessionWindow(sets);
    expect(sessions.length).toBe(8);
    // más reciente primero
    expect(sessions[0].date >= sessions[7].date).toBe(true);
  });

  it('ignora sets sin reps/weight válidos', () => {
    const sets: SetLike[] = [
      { weight: 0, reps: 5, is_warmup: false, workout: { started_at: '2026-10-19T10:00:00Z' } },
      { weight: 80, reps: 0, is_warmup: false, workout: { started_at: '2026-10-19T10:00:00Z' } },
      set('2026-10-19T10:00:00Z', 80, 8),
    ];
    const sessions = toSessionWindow(sets);
    expect(sessions.length).toBe(1);
    expect(sessions[0].sets.length).toBe(1);
  });
});
