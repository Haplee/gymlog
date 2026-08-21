import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LOAD_STEP_KG,
  MAX_INCREASE_RATIO,
  backOffLoad,
  nextAchievableLoad,
  smallestLoadStep,
} from '../loadStep';
/** Desenvuelve un resultado que el test da por hecho que existe. */
function exigir<T>(value: T | null | undefined, que = 'el resultado'): T {
  if (value === null || value === undefined) throw new Error(`${que} no debería faltar`);
  return value;
}

describe('smallestLoadStep — el escalón lo marca el gimnasio', () => {
  it('sin discos declarados cae al juego olímpico estándar', () => {
    expect(smallestLoadStep()).toBe(DEFAULT_LOAD_STEP_KG);
    expect(smallestLoadStep([])).toBe(DEFAULT_LOAD_STEP_KG);
  });

  it('el disco más pequeño va por pares: 1,25 en cada lado son 2,5 kg', () => {
    expect(smallestLoadStep([25, 20, 10, 5, 2.5, 1.25])).toBe(2.5);
  });

  it('una sala sin discos pequeños tiene un escalón grande de verdad', () => {
    expect(smallestLoadStep([25, 20, 10, 5])).toBe(10);
  });

  it('con micro-discos el escalón baja: es progresión que el usuario ya tiene', () => {
    expect(smallestLoadStep([20, 10, 5, 1.25, 0.5])).toBe(1);
  });

  it('en mancuerna el disco no va por pares', () => {
    expect(smallestLoadStep([2.5, 1.25], { paired: false })).toBe(1.25);
  });
});

describe('nextAchievableLoad — subir solo lo que se puede montar', () => {
  it('busca la subida relativa pedida y la redondea al escalón', () => {
    // 2,5 % de 100 kg son 102,5: justo un escalón.
    expect(nextAchievableLoad(100, { ratio: 0.025, stepKg: 2.5 })).toBe(102.5);
  });

  it('nunca devuelve la misma carga: si el redondeo se come la subida, sube un escalón', () => {
    // 2,5 % de 60 kg son 61,5, que redondea a 60. Debe forzar 62,5.
    expect(nextAchievableLoad(60, { ratio: 0.025, stepKg: 2.5 })).toBe(62.5);
  });

  it('con cargas ligeras y escalón grande devuelve null: por carga no toca', () => {
    // 2,5 kg sobre 10 kg es un +25 %, muy por encima del tope del 10 %.
    expect(nextAchievableLoad(10, { ratio: 0.025, stepKg: 2.5 })).toBeNull();
  });

  it('esa misma carga sí progresa si el gimnasio tiene micro-discos', () => {
    expect(nextAchievableLoad(10, { ratio: 0.025, stepKg: 0.5 })).toBe(10.5);
  });

  it('respeta el tope duro aunque se pida una subida enorme', () => {
    const target = nextAchievableLoad(100, { ratio: 0.5, stepKg: 2.5 });
    expect(target).not.toBeNull();
    expect(exigir(target)).toBeLessThanOrEqual(100 * (1 + MAX_INCREASE_RATIO));
  });

  it('con base inválida no inventa nada', () => {
    expect(nextAchievableLoad(0)).toBeNull();
    expect(nextAchievableLoad(Number.NaN)).toBeNull();
  });
});

describe('backOffLoad', () => {
  it('retrocede el porcentaje pedido y redondea a algo montable', () => {
    expect(backOffLoad(100, 0.1, 2.5)).toBe(90);
    expect(backOffLoad(123, 0.1, 2.5)).toBe(110);
  });

  it('nunca baja de un escalón: 0 kg no es una descarga', () => {
    expect(backOffLoad(2, 0.9, 2.5)).toBe(2.5);
  });
});
