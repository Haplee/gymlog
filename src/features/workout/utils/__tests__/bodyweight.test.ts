import { describe, expect, it } from 'vitest';
import { bodyWeightAtDate, bodyweightSetVolume, daysSinceLastWeight } from '../bodyweight';

const measures = [
  { date: '2026-06-01', weight_kg: 80 },
  { date: '2026-07-01', weight_kg: 78 },
  { date: '2026-07-10', weight_kg: null },
];

describe('bodyWeightAtDate', () => {
  it('uses the most recent weight on or before the date', () => {
    expect(bodyWeightAtDate(measures, '2026-07-05')).toBe(78);
    expect(bodyWeightAtDate(measures, '2026-06-15')).toBe(80);
  });

  it('ignores measurements after the date (historical accuracy)', () => {
    expect(bodyWeightAtDate(measures, '2026-05-01')).toBeNull();
  });

  it('returns null when there is no weight', () => {
    expect(bodyWeightAtDate([{ date: '2026-01-01', weight_kg: null }], '2026-02-01')).toBeNull();
  });
});

describe('bodyweightSetVolume', () => {
  it('estimates volume from body weight × reps', () => {
    expect(bodyweightSetVolume(80, 0, 10)).toBe(800);
  });

  it('adds external load (lastre)', () => {
    expect(bodyweightSetVolume(80, 20, 5)).toBe(500);
  });

  it('falls back to added load when no body weight', () => {
    expect(bodyweightSetVolume(null, 15, 4)).toBe(60);
  });
});

describe('daysSinceLastWeight', () => {
  it('counts days since the last weight entry', () => {
    expect(daysSinceLastWeight(measures, '2026-07-08')).toBe(7);
  });

  it('returns null when never recorded', () => {
    expect(daysSinceLastWeight([], '2026-07-08')).toBeNull();
  });
});
