import { describe, it, expect } from 'vitest';
import {
  kgToLb,
  lbToKg,
  formatWeight,
  formatVolume,
  parseWeightInput,
  convertToDisplayUnit,
  convertFromDisplayUnit,
} from '../weight';

describe('kgToLb / lbToKg', () => {
  it('convierte ida y vuelta sin perder precisión relevante', () => {
    expect(lbToKg(kgToLb(100))).toBeCloseTo(100, 6);
    expect(kgToLb(1)).toBeCloseTo(2.20462, 5);
  });

  it('devuelve 0 para entradas inválidas', () => {
    expect(kgToLb(NaN)).toBe(0);
    expect(lbToKg(NaN)).toBe(0);
  });
});

describe('formatWeight', () => {
  it('formatea en kg sin convertir', () => {
    expect(formatWeight(80, 'kg')).toBe('80.0 kg');
  });

  it('convierte a lb', () => {
    expect(formatWeight(100, 'lb')).toBe('220.5 lb');
  });
});

describe('formatVolume', () => {
  it('muestra toneladas para kg', () => {
    expect(formatVolume(1500, 'kg')).toBe('1.5t');
  });

  it('muestra miles de libras para lb (regresión: antes mostraba lb crudas, 1000x)', () => {
    // 1000 kg = 2204.62 lb = 2.2 k lb
    expect(formatVolume(1000, 'lb')).toBe('2.2k lb');
  });

  it('devuelve 0 para entrada inválida', () => {
    expect(formatVolume(NaN, 'kg')).toBe('0');
  });
});

describe('parseWeightInput', () => {
  it('acepta coma decimal', () => {
    expect(parseWeightInput('12,5', 'kg')).toBe(12.5);
  });

  it('convierte lb a kg internamente', () => {
    expect(parseWeightInput('220.462', 'lb')).toBeCloseTo(100, 3);
  });

  it('devuelve 0 si no es número', () => {
    expect(parseWeightInput('abc', 'kg')).toBe(0);
  });
});

describe('convertToDisplayUnit / convertFromDisplayUnit', () => {
  it('round-trip en lb', () => {
    expect(convertFromDisplayUnit(convertToDisplayUnit(50, 'lb'), 'lb')).toBeCloseTo(50, 6);
  });

  it('identidad en kg', () => {
    expect(convertToDisplayUnit(50, 'kg')).toBe(50);
    expect(convertFromDisplayUnit(50, 'kg')).toBe(50);
  });
});
