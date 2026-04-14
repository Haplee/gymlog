import { describe, it, expect } from 'vitest';
import { calcular1RM } from '../brzycki';

describe('calcular1RM (Fórmula de Brzycki)', () => {
  it('debería retornar 0 si el peso o las reps son 0 o inválidos', () => {
    expect(calcular1RM(0, 5)).toBe(0);
    expect(calcular1RM(100, 0)).toBe(0);
    expect(calcular1RM(-50, 5)).toBe(0); // weight <= 0 is passed normally but !weight covers 0. wait, !weight applies to 0
    expect(calcular1RM(100, -2)).toBe(0);
  });

  it('debería retornar el mismo peso si las reps son 1', () => {
    expect(calcular1RM(100, 1)).toBe(100);
    expect(calcular1RM(225, 1)).toBe(225);
  });

  it('debería calcular correctamente el 1RM para valores normales', () => {
    // 100 kg x 5 reps -> 100 / (1.0278 - 0.0278 * 5) = 112.5
    expect(calcular1RM(100, 5)).toBeCloseTo(112.5, 1);

    // 80 kg x 10 reps -> 80 / (1.0278 - 0.0278 * 10) = 106.7
    expect(calcular1RM(80, 10)).toBeCloseTo(106.7, 1);
  });

  it('debería manejar decimales en el peso', () => {
    expect(calcular1RM(52.5, 6)).toBeCloseTo(61.0, 1);
  });
});
