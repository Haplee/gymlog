import { describe, it, expect } from 'vitest';
import { calcular1RM } from '../brzycki';

describe('Fórmula de Brzycki (1RM)', () => {
  it('debe calcular 1RM correctamente para 100kg a 10 reps', () => {
    // 100 / (1.0278 - 0.0278 * 10) = 100 / (1.0278 - 0.278) = 100 / 0.7498 = ~133.36
    const result = calcular1RM(100, 10);
    expect(result).toBeCloseTo(133.4, 1);
  });

  it('debe calcular 1RM correctamente para 80kg a 5 reps', () => {
    // 80 / (1.0278 - 0.0278 * 5) = 80 / (1.0278 - 0.139) = 80 / 0.8888 = ~90.01
    const result = calcular1RM(80, 5);
    expect(result).toBeCloseTo(90.0, 1);
  });

  it('devuelve NaN si las repeticiones son muy altas y la fórmula div por cero/negativo', () => {
    // la fórmula pierde precisión/falla si reps >= 37 (1.0278 / 0.0278 ≈ 36.97)
    // No exigimos que falle con gracia ahora, pero validamos que devuelva valores no realistas o Infinity.
    const result = calcular1RM(100, 37);
    expect(result).toBeLessThan(0); // El denominador se vuelve negativo
  });

  it('debe manejar 1 repetición devolviendo exactamente el peso levantado', () => {
    // 100 / (1.0278 - 0.0278) = 100 / 1 = 100
    const result = calcular1RM(100, 1);
    expect(result).toBeCloseTo(100, 1);
  });

  it('debe devolver 0 si el peso es 0', () => {
    const result = calcular1RM(0, 10);
    expect(result).toBe(0);
  });
});
