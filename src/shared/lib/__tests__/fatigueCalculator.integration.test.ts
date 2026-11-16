import { describe, expect, it } from 'vitest';
import { calculateFatiguePenalty } from '../fatigueCalculator';
import { suggestProgression } from '../progression';

describe('fatigueCalculator + suggestProgression', () => {
  it('integra el cálculo de fatiga con la reducción de peso', () => {
    const fatiguePenalty = calculateFatiguePenalty(10, 3);
    const suggestion = suggestProgression([{ weight: 100, reps: 8 }], {
      repMin: 8,
      repMax: 12,
      fatigueContext: {
        priorSets: 10,
        fatiguePenalty,
        sessionCount: 3,
      },
    });

    expect(fatiguePenalty).toBe(0.1);
    expect(suggestion?.weight).toBe(90);
    expect(suggestion?.fatigueApplied).toBe(0.1);
  });

  it('nunca reduce más del 10 % del peso', () => {
    const fatiguePenalty = calculateFatiguePenalty(100, 3);
    const suggestion = suggestProgression([{ weight: 100, reps: 8 }], {
      repMin: 8,
      repMax: 12,
      fatigueContext: {
        priorSets: 100,
        fatiguePenalty,
        sessionCount: 3,
      },
    });

    expect(suggestion?.weight).toBe(90);
    expect(suggestion?.fatigueApplied).toBeLessThanOrEqual(0.1);
  });
});
