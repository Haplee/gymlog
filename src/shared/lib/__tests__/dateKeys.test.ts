import { describe, it, expect } from 'vitest';
import { shiftDateKey, toLocalDateKey } from '../dateKeys';

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

describe('shiftDateKey', () => {
  it('suma y resta días cruzando meses y años', () => {
    expect(shiftDateKey('2026-01-05', -1)).toBe('2026-01-04');
    expect(shiftDateKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateKey('2024-02-28', 1)).toBe('2024-02-29'); // bisiesto
  });

  it('no depende de la zona horaria del equipo', () => {
    // Se opera en UTC: en cualquier zona debe devolver el mismo día.
    expect(shiftDateKey('2026-03-29', 1)).toBe('2026-03-30');
  });

  it('con una fecha inválida devuelve la entrada sin romper', () => {
    expect(shiftDateKey('no-es-fecha', 1)).toBe('no-es-fecha');
  });
});
