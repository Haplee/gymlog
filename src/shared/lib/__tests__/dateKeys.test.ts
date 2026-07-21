import { describe, it, expect } from 'vitest';
import { toLocalDateKey } from '../dateKeys';

describe('toLocalDateKey', () => {
  it('formatea como YYYY-MM-DD en hora local', () => {
    // Construido con componentes locales: no depende de la zona del runner.
    const d = new Date(2026, 6, 21, 10, 30); // 21 jul 2026 10:30 local
    expect(toLocalDateKey(d)).toBe('2026-07-21');
  });

  it('rellena con ceros mes y día de un dígito', () => {
    const d = new Date(2026, 0, 5, 0, 0); // 5 ene 2026
    expect(toLocalDateKey(d)).toBe('2026-01-05');
  });

  it('usa el día LOCAL, no UTC (un entreno nocturno no se desplaza)', () => {
    // 23:30 hora local del 21 sigue siendo día 21, aunque en UTC pudiera ser 22.
    const d = new Date(2026, 6, 21, 23, 30);
    expect(toLocalDateKey(d)).toBe('2026-07-21');
    // toISOString() podría dar otro día según la zona; el nuestro no.
    expect(toLocalDateKey(d)).toBe('2026-07-21');
  });

  it('maneja el último día del año', () => {
    const d = new Date(2026, 11, 31, 12, 0);
    expect(toLocalDateKey(d)).toBe('2026-12-31');
  });
});
