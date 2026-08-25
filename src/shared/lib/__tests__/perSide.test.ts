import { describe, it, expect } from 'vitest';
import { repStep, totalFromPerSide, perSideCount, nextRepTarget } from '../perSide';

describe('repStep', () => {
  it('un ejercicio normal sube de una en una', () => {
    expect(repStep({})).toBe(1);
    expect(repStep({ perSide: false })).toBe(1);
    expect(repStep(null)).toBe(1);
    expect(repStep(undefined)).toBe(1);
  });

  it('por lado sube de dos en dos', () => {
    expect(repStep({ perSide: true })).toBe(2);
  });
});

describe('totalFromPerSide', () => {
  it('el plan dice 12 por lado: se registran 24', () => {
    expect(totalFromPerSide(12, true)).toBe(24);
  });

  it('sin la bandera el número es el que es', () => {
    expect(totalFromPerSide(12, false)).toBe(12);
    expect(totalFromPerSide(12, undefined)).toBe(12);
  });
});

describe('perSideCount', () => {
  it('16 en total son 8 por lado', () => {
    expect(perSideCount(16, true)).toBe(8);
  });

  it('un total impar da medio, que es la señal de que los lados no fueron iguales', () => {
    expect(perSideCount(15, true)).toBe(7.5);
  });

  it('sin la bandera no hay lectura por lado', () => {
    expect(perSideCount(16, false)).toBeNull();
    expect(perSideCount(16)).toBeNull();
  });

  it('un total que no es un número no inventa un medio', () => {
    expect(perSideCount(Number.NaN, true)).toBeNull();
  });
});

describe('nextRepTarget', () => {
  it('un ejercicio normal va de uno en uno', () => {
    expect(nextRepTarget(10)).toBe(11);
    expect(nextRepTarget(10, { perSide: false })).toBe(11);
  });

  it('por lado va 16 → 18 → 20, nunca a un impar', () => {
    expect(nextRepTarget(16, { perSide: true })).toBe(18);
    expect(nextRepTarget(18, { perSide: true })).toBe(20);
  });

  it('un objetivo que ya venía impar se corrige en la primera subida', () => {
    // 17 no es un objetivo posible por lado. Sumar 1 daría 18 por casualidad,
    // pero desde 15 daría 16 y desde 13 daría 14: lo que se comprueba es que la
    // regla vale desde cualquier impar, no que acierte por suerte.
    expect(nextRepTarget(15, { perSide: true })).toBe(16);
    expect(nextRepTarget(17, { perSide: true })).toBe(18);
  });

  it('nunca devuelve un objetivo impar para un ejercicio por lado', () => {
    for (let n = 1; n <= 40; n++) {
      expect(nextRepTarget(n, { perSide: true }) % 2).toBe(0);
    }
  });

  it('siempre sube: nunca se queda igual ni baja', () => {
    for (let n = 1; n <= 40; n++) {
      expect(nextRepTarget(n, { perSide: true })).toBeGreaterThan(n);
    }
  });
});
