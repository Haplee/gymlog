import { describe, it, expect } from 'vitest';
import {
  calculateMuscleGroupDistribution,
  formatSeconds,
  PERIOD_LABELS,
  PERIOD_WEEKS,
} from '../statsData';

describe('PERIOD_LABELS', () => {
  it('tiene etiqueta para cada periodo', () => {
    expect(PERIOD_LABELS['4semanas']).toBe('4 sem');
    expect(PERIOD_LABELS['3meses']).toBe('3 mes');
    expect(PERIOD_LABELS['6meses']).toBe('6 mes');
    expect(PERIOD_LABELS['1año']).toBe('1 año');
  });
});

describe('PERIOD_WEEKS', () => {
  it('tiene semanas correctas para cada periodo', () => {
    expect(PERIOD_WEEKS['4semanas']).toBe(4);
    expect(PERIOD_WEEKS['3meses']).toBe(12);
    expect(PERIOD_WEEKS['6meses']).toBe(24);
    expect(PERIOD_WEEKS['1año']).toBe(52);
  });
});

describe('formatSeconds', () => {
  it('devuelve solo minutos si < 1h', () => {
    expect(formatSeconds(0)).toBe('0m');
    expect(formatSeconds(45)).toBe('0m');
    expect(formatSeconds(90)).toBe('1m');
    expect(formatSeconds(3599)).toBe('59m');
  });

  it('devuelve formato h:mm si >= 1h', () => {
    expect(formatSeconds(3600)).toBe('1h 0m');
    expect(formatSeconds(3661)).toBe('1h 1m');
    expect(formatSeconds(7380)).toBe('2h 3m');
  });
});

describe('calculateMuscleGroupDistribution', () => {
  it('distribuye volumen por grupo muscular excluyendo warmup', () => {
    const sets = [
      { weight: 10, reps: 10, is_warmup: false, exercise: { muscle_group: 'Pecho' } },
      { weight: 20, reps: 5, is_warmup: false, exercise: { muscle_group: 'Pecho' } },
      { weight: 5, reps: 10, is_warmup: true, exercise: { muscle_group: 'Pecho' } },
      { weight: 30, reps: 8, is_warmup: false, exercise: { muscle_group: 'Espalda' } },
    ];
    const result = calculateMuscleGroupDistribution(sets);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Espalda');
    expect(result[0].value).toBe(240);
    expect(result[1].name).toBe('Pecho');
    expect(result[1].value).toBe(200);
  });

  it('usa "Otro" si no hay muscle_group', () => {
    const sets = [{ weight: 10, reps: 10, is_warmup: false, exercise: null }];
    const result = calculateMuscleGroupDistribution(sets);
    expect(result[0].name).toBe('Otro');
  });

  it('devuelve array vacío si no hay sets', () => {
    expect(calculateMuscleGroupDistribution([])).toEqual([]);
  });

  it('reparte el volumen entre músculos ponderados cuando hay mapa', () => {
    const sets = [
      {
        weight: 100,
        reps: 1,
        is_warmup: false,
        exercise_id: 'x',
        exercise: { muscle_group: 'Espalda' },
      },
    ];
    const map = {
      x: [
        { muscle_group: 'Espalda', role: 'primary' as const, weight: 60 },
        { muscle_group: 'Glúteo', role: 'secondary' as const, weight: 40 },
      ],
    };
    const result = calculateMuscleGroupDistribution(sets, map);
    const espalda = result.find((r) => r.name === 'Espalda');
    const gluteo = result.find((r) => r.name === 'Glúteo');
    expect(espalda?.value).toBeCloseTo(60);
    expect(gluteo?.value).toBeCloseTo(40);
  });

  it('cae al muscle_group único si el mapa no cubre el exercise_id (retrocompatible)', () => {
    const sets = [
      {
        weight: 10,
        reps: 10,
        is_warmup: false,
        exercise_id: 'z',
        exercise: { muscle_group: 'Pecho' },
      },
    ];
    const result = calculateMuscleGroupDistribution(sets, {});
    expect(result[0].name).toBe('Pecho');
    expect(result[0].value).toBe(100);
  });
});
