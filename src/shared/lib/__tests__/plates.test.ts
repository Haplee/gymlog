import { describe, it, expect } from 'vitest';
import { calcularDiscos, DEFAULT_BAR_KG } from '../plates';

describe('calcularDiscos', () => {
  it('devuelve vacío si el objetivo es menor o igual al peso de la barra', () => {
    expect(calcularDiscos(20)).toEqual({ perSide: [], totalAchievable: 20, leftoverPerSide: 0 });
    expect(calcularDiscos(15)).toEqual({ perSide: [], totalAchievable: 20, leftoverPerSide: 0 });
  });

  it('reparte 100 kg con barra de 20 kg en 40 kg por lado', () => {
    const r = calcularDiscos(100);
    // 40 por lado = 25 + 15
    expect(r.perSide).toEqual([
      { weight: 25, count: 1 },
      { weight: 15, count: 1 },
    ]);
    expect(r.totalAchievable).toBe(100);
    expect(r.leftoverPerSide).toBe(0);
  });

  it('usa varios discos del mismo peso', () => {
    const r = calcularDiscos(140); // 60 por lado = 25 + 25 + 10
    expect(r.perSide).toEqual([
      { weight: 25, count: 2 },
      { weight: 10, count: 1 },
    ]);
    expect(r.totalAchievable).toBe(140);
  });

  it('maneja fracciones de 2.5 y 1.25 sin error de coma flotante', () => {
    const r = calcularDiscos(67.5); // 23.75 por lado = 20 + 2.5 + 1.25
    expect(r.perSide).toEqual([
      { weight: 20, count: 1 },
      { weight: 2.5, count: 1 },
      { weight: 1.25, count: 1 },
    ]);
    expect(r.leftoverPerSide).toBe(0);
    expect(r.totalAchievable).toBe(67.5);
  });

  it('reporta el sobrante cuando no hay discos suficientemente pequeños', () => {
    const r = calcularDiscos(102, DEFAULT_BAR_KG, [25, 20, 10, 5]); // 41 por lado, sin 2.5/1.25
    expect(r.leftoverPerSide).toBe(1);
    expect(r.totalAchievable).toBe(100);
  });

  it('acepta barras de otro peso', () => {
    const r = calcularDiscos(50, 10); // 20 por lado = 20
    expect(r.perSide).toEqual([{ weight: 20, count: 1 }]);
    expect(r.totalAchievable).toBe(50);
  });

  it('devuelve vacío ante entradas no finitas', () => {
    expect(calcularDiscos(NaN).perSide).toEqual([]);
    expect(calcularDiscos(Infinity).perSide).toEqual([]);
  });
});
