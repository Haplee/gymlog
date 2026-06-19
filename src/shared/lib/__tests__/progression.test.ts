import { describe, it, expect } from 'vitest';
import { suggestProgression } from '../progression';

describe('suggestProgression', () => {
  it('devuelve null sin series válidas', () => {
    expect(suggestProgression([])).toBeNull();
    expect(suggestProgression([{ reps: 0, weight: 0 }])).toBeNull();
  });

  it('sube peso y vuelve al suelo del rango al alcanzar el techo', () => {
    const s = suggestProgression([
      { reps: 12, weight: 100 },
      { reps: 12, weight: 100 },
    ]);
    expect(s).toEqual({ weight: 102.5, reps: 8, action: 'increase-weight' });
  });

  it('suma 1 rep si no llega al techo', () => {
    const s = suggestProgression([
      { reps: 9, weight: 80 },
      { reps: 8, weight: 80 },
    ]);
    expect(s).toEqual({ weight: 80, reps: 10, action: 'add-reps' });
  });

  it('usa la mejor serie (mayor peso) como referencia', () => {
    const s = suggestProgression([
      { reps: 12, weight: 60 },
      { reps: 6, weight: 90 },
    ]);
    // top = 90×6, no llega a repMax → +1 rep
    expect(s).toEqual({ weight: 90, reps: 7, action: 'add-reps' });
  });

  it('respeta rango e incremento personalizados', () => {
    const s = suggestProgression([{ reps: 5, weight: 140 }], {
      repMin: 3,
      repMax: 5,
      incrementKg: 5,
    });
    expect(s).toEqual({ weight: 145, reps: 3, action: 'increase-weight' });
  });
});
