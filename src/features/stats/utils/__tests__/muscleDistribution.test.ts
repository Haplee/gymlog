import { describe, expect, it } from 'vitest';
import { distributeVolume } from '../muscleDistribution';

describe('distributeVolume', () => {
  it('splits 60/40 across two muscles', () => {
    const r = distributeVolume(100, [
      { muscle_group: 'Espalda', weight: 60 },
      { muscle_group: 'Bíceps', weight: 40 },
    ]);
    expect(r).toEqual({ Espalda: 60, Bíceps: 40 });
  });

  it('single primary at 100 gets the full volume (unchanged behavior)', () => {
    const r = distributeVolume(250, [{ muscle_group: 'Pecho', weight: 100 }]);
    expect(r).toEqual({ Pecho: 250 });
  });

  it('normalizes weights that do not sum to 100', () => {
    const r = distributeVolume(100, [
      { muscle_group: 'Pierna', weight: 30 },
      { muscle_group: 'Glúteo', weight: 10 },
    ]);
    // 30/40 y 10/40
    expect(r.Pierna).toBeCloseTo(75);
    expect(r.Glúteo).toBeCloseTo(25);
  });

  it('is deterministic (same totals across runs)', () => {
    const muscles = [
      { muscle_group: 'Espalda', weight: 55 },
      { muscle_group: 'Bíceps', weight: 25 },
      { muscle_group: 'Core', weight: 20 },
    ];
    expect(distributeVolume(80, muscles)).toEqual(distributeVolume(80, muscles));
  });

  it('empty muscles returns empty map', () => {
    expect(distributeVolume(100, [])).toEqual({});
  });

  it('all-zero weights falls back to the first muscle', () => {
    const r = distributeVolume(100, [
      { muscle_group: 'Otro', weight: 0 },
      { muscle_group: 'Core', weight: 0 },
    ]);
    expect(r).toEqual({ Otro: 100 });
  });
});
