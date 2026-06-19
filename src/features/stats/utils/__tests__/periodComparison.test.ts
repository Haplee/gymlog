import { describe, it, expect } from 'vitest';
import { comparePeriods } from '../periodComparison';
import type { VolumeSet } from '../kpiCalculations';

const now = new Date('2026-06-13T12:00:00Z');

function setOn(daysAgo: number, weight: number, reps: number, warmup = false): VolumeSet {
  const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return { weight, reps, is_warmup: warmup, workout: { started_at: d.toISOString() } };
}

describe('comparePeriods', () => {
  it('reparte volumen y sesiones en ventana actual vs anterior', () => {
    const sets: VolumeSet[] = [
      setOn(5, 100, 10), // actual → 1000
      setOn(40, 50, 10), // anterior → 500
    ];
    const r = comparePeriods(sets, 30, now);
    expect(r.current.volume).toBe(1000);
    expect(r.previous.volume).toBe(500);
    expect(r.current.sessions).toBe(1);
    expect(r.previous.sessions).toBe(1);
    expect(r.volumeChangePct).toBe(100); // (1000-500)/500
  });

  it('excluye calentamientos', () => {
    const sets: VolumeSet[] = [setOn(2, 100, 10, true), setOn(2, 60, 5)];
    const r = comparePeriods(sets, 30, now);
    expect(r.current.volume).toBe(300);
  });

  it('cuenta sesiones por día único', () => {
    const sets: VolumeSet[] = [setOn(3, 100, 5), setOn(3, 80, 5), setOn(6, 80, 5)];
    const r = comparePeriods(sets, 30, now);
    expect(r.current.sessions).toBe(2);
  });

  it('100% si no había volumen previo', () => {
    const r = comparePeriods([setOn(1, 100, 10)], 30, now);
    expect(r.previous.volume).toBe(0);
    expect(r.volumeChangePct).toBe(100);
  });
});
