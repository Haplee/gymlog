import { describe, expect, it } from 'vitest';
import {
  buildProgressionData,
  calculateEstimated1RM,
  calculateSessionVolume,
} from '../progressionMetrics';

describe('progressionMetrics', () => {
  it('estima el 1RM con la fórmula de Brzycki', () => {
    expect(calculateEstimated1RM(100, 5)).toBeCloseTo(100 / (1.0278 - 0.0278 * 5), 8);
    expect(calculateEstimated1RM(80, 1)).toBe(80);
  });

  it('suma el volumen de todas las series', () => {
    expect(
      calculateSessionVolume([
        { weight: 60, reps: 8 },
        { weight: 80, reps: 5 },
      ]),
    ).toBe(880);
  });

  it('filtra por ejercicio, ordena fechas y marca récords sucesivos', () => {
    const result = buildProgressionData(
      [
        {
          weight: 100,
          reps: 5,
          exercise: { name: 'Press banca' },
          workout: { started_at: '2026-10-20T10:00:00.000Z' },
        },
        {
          weight: 90,
          reps: 5,
          exercise: { name: 'Sentadilla' },
          workout: { started_at: '2026-10-19T10:00:00.000Z' },
        },
        {
          weight: 110,
          reps: 5,
          exercise: { name: 'Press banca' },
          workout: { started_at: '2026-10-21T10:00:00.000Z' },
        },
      ],
      'Press banca',
      'maxWeight',
    );

    expect(result).toEqual([
      { date: '2026-10-20', value: 100, isPR: true },
      { date: '2026-10-21', value: 110, isPR: true },
    ]);
  });

  it('usa el máximo de 1RM de cada día', () => {
    const result = buildProgressionData(
      [
        {
          weight: 80,
          reps: 5,
          exercise: { name: 'Remo' },
          workout: { started_at: '2026-10-20T10:00:00.000Z' },
        },
        {
          weight: 100,
          reps: 1,
          exercise: { name: 'Remo' },
          workout: { started_at: '2026-10-20T11:00:00.000Z' },
        },
      ],
      'Remo',
    );

    expect(result).toEqual([{ date: '2026-10-20', value: 100, isPR: true }]);
  });

  it('calcula volumen diario con la métrica volume', () => {
    const result = buildProgressionData(
      [
        {
          weight: 50,
          reps: 10,
          exercise: { name: 'Curl' },
          workout: { started_at: '2026-10-20T10:00:00.000Z' },
        },
        {
          weight: 60,
          reps: 5,
          exercise: { name: 'Curl' },
          workout: { started_at: '2026-10-20T10:30:00.000Z' },
        },
      ],
      'Curl',
      'volume',
    );

    expect(result).toEqual([{ date: '2026-10-20', value: 800, isPR: true }]);
  });

  it('descarta series sin fecha y valores no positivos', () => {
    const result = buildProgressionData(
      [
        {
          weight: 100,
          reps: 5,
          exercise: { name: 'Press' },
          workout: { started_at: null },
        },
        {
          weight: 0,
          reps: 5,
          exercise: { name: 'Press' },
          workout: { started_at: '2026-10-20T10:00:00.000Z' },
        },
      ],
      'Press',
      'maxWeight',
    );

    expect(result).toEqual([]);
  });
});
