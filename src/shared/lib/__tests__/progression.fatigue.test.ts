import { describe, expect, it } from 'vitest';
import { suggestProgression } from '../progression';

describe('suggestProgression con fatiga', () => {
  it('aplica una penalización del 5 % al peso sugerido', () => {
    const suggestion = suggestProgression([{ weight: 100, reps: 8 }], {
      repMin: 8,
      repMax: 12,
      fatiguePenalty: 0.05,
    });

    expect(suggestion?.weight).toBe(95);
    expect(suggestion?.fatigueApplied).toBe(0.05);
  });

  it('aplica el máximo del 10 % al peso sugerido', () => {
    const suggestion = suggestProgression([{ weight: 100, reps: 8 }], {
      repMin: 8,
      repMax: 12,
      fatiguePenalty: 0.1,
    });

    expect(suggestion?.weight).toBe(90);
    expect(suggestion?.fatigueApplied).toBe(0.1);
  });
});
