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

  // ── Inventarios no canónicos ──────────────────────────────────────
  // Con un 1,5 y un 1,25 conviviendo, coger siempre el disco más grande que
  // quepa deja de ser óptimo. Estos casos fallaban con el algoritmo voraz.
  describe('inventario con 1,5 y 1,25 (no canónico)', () => {
    const GIMNASIO = [25, 20, 15, 10, 5, 2.5, 1.5, 1.25, 0.5];

    it('clava 2,75 por lado combinando 1,5 + 1,25 en vez de dejar 0,25 sin cubrir', () => {
      const r = calcularDiscos(25.5, DEFAULT_BAR_KG, GIMNASIO); // 2,75 por lado
      expect(r.leftoverPerSide).toBe(0);
      expect(r.totalAchievable).toBe(25.5);
      expect(r.perSide).toEqual([
        { weight: 1.5, count: 1 },
        { weight: 1.25, count: 1 },
      ]);
    });

    it('clava 3,25 por lado', () => {
      const r = calcularDiscos(26.5, DEFAULT_BAR_KG, GIMNASIO); // 3,25 por lado
      expect(r.leftoverPerSide).toBe(0);
      expect(r.totalAchievable).toBe(26.5);
    });

    it('clava un peso alto que el voraz no alcanzaba (41,75 por lado)', () => {
      const r = calcularDiscos(103.5, DEFAULT_BAR_KG, GIMNASIO);
      expect(r.leftoverPerSide).toBe(0);
      expect(r.totalAchievable).toBe(103.5);
    });

    it('a igualdad de peso alcanzado, usa el menor número de discos', () => {
      const r = calcularDiscos(30, DEFAULT_BAR_KG, GIMNASIO); // 5 por lado
      expect(r.perSide).toEqual([{ weight: 5, count: 1 }]);
    });
  });

  it('baja al peso alcanzable más cercano por debajo cuando no puede clavarlo', () => {
    const r = calcularDiscos(21, DEFAULT_BAR_KG, [5]); // 0,5 por lado, solo discos de 5
    expect(r.perSide).toEqual([]);
    expect(r.totalAchievable).toBe(20);
    expect(r.leftoverPerSide).toBe(0.5);
  });

  it('no se descuadra por coma flotante con muchos discos pequeños', () => {
    const r = calcularDiscos(35, DEFAULT_BAR_KG, [2.5]); // 7,5 por lado = 2,5 × 3
    expect(r.perSide).toEqual([{ weight: 2.5, count: 3 }]);
    expect(r.leftoverPerSide).toBe(0);
  });

  it('sin discos disponibles, todo el peso queda como sobrante', () => {
    const r = calcularDiscos(60, DEFAULT_BAR_KG, []);
    expect(r.perSide).toEqual([]);
    expect(r.leftoverPerSide).toBe(20);
  });
});
