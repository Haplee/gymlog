import { describe, it, expect } from 'vitest';
import { calcular1RM } from '@shared/lib/brzycki';
import { computeBestEstimate, computeSessionVolume, countValidSets } from '../sessionMetrics';

describe('computeSessionVolume', () => {
  it('suma peso × reps de cada serie (modo normal)', () => {
    expect(
      computeSessionVolume(
        [
          { reps: '10', weight: '50' }, // 500
          { reps: '5', weight: '100' }, // 500
        ],
        false,
        null,
      ),
    ).toBe(1000);
  });

  it('en modo peso corporal suma el cuerpo más el lastre', () => {
    // 10 reps × (70 kg de cuerpo + 10 kg de lastre)
    expect(computeSessionVolume([{ reps: '10', weight: '10' }], true, 70)).toBe(800);
  });

  it('en modo peso corporal sin peso corporal conocido solo cuenta el lastre', () => {
    expect(computeSessionVolume([{ reps: '10', weight: '10' }], true, null)).toBe(100);
  });

  it('ignora filas sin reps', () => {
    expect(computeSessionVolume([{ reps: '', weight: '100' }], false, null)).toBe(0);
  });
});

describe('countValidSets', () => {
  it('en modo normal exige peso', () => {
    expect(
      countValidSets(
        [
          { reps: '8', weight: '' },
          { reps: '8', weight: '80' },
        ],
        false,
      ),
    ).toBe(1);
  });

  it('en modo peso corporal basta con las reps', () => {
    expect(countValidSets([{ reps: '8', weight: '' }], true)).toBe(1);
  });

  it('sin reps no cuenta aunque haya peso', () => {
    expect(countValidSets([{ reps: '', weight: '80' }], false)).toBe(0);
  });
});

describe('computeBestEstimate', () => {
  it('elige la serie con mayor 1RM estimado', () => {
    // 100×10 ≈ 133,4 kg; 120×5 ≈ 135,0 kg → gana la segunda.
    const best = computeBestEstimate([
      { reps: '10', weight: '100' },
      { reps: '5', weight: '120' },
    ]);
    expect(best?.weightKg).toBe(120);
    expect(best?.e1rm).toBeCloseTo(calcular1RM(120, 5), 5);
  });

  it('excluye los calentamientos', () => {
    const best = computeBestEstimate([
      { reps: '8', weight: '60' },
      { reps: '3', weight: '200', isWarmup: true },
    ]);
    expect(best?.weightKg).toBe(60);
  });

  it('una sola repetición vale el propio peso', () => {
    expect(computeBestEstimate([{ reps: '1', weight: '140' }])).toEqual({
      weightKg: 140,
      e1rm: 140,
    });
  });

  it('ignora filas sin peso o sin reps', () => {
    expect(
      computeBestEstimate([
        { reps: '10', weight: '' },
        { reps: '', weight: '80' },
        { reps: '0', weight: '80' },
      ]),
    ).toBeNull();
  });

  it('lista vacía devuelve null', () => {
    expect(computeBestEstimate([])).toBeNull();
  });
});
