import { describe, it, expect } from 'vitest';
import {
  toDebtSeries,
  toNightlyHours,
  toReadinessDays,
  toRestNight,
  toRhrSeries,
  toSleepHoursSeries,
} from '../scoringInputs';
import type { WearableDaily, WearableSleep } from '../../types';

const daily = (date: string, restingHr: number | null): WearableDaily => ({
  id: `d-${date}`,
  user_id: 'u1',
  date,
  source: 'health_connect',
  steps: 8000,
  distance_km: 5,
  calories: 2200,
  resting_hr: restingHr,
  avg_hr: 75,
  max_hr: 150,
  created_at: '2026-01-01T00:00:00Z',
});

const sleep = (
  date: string,
  durationMin: number | null,
  extra: Partial<WearableSleep> = {},
): WearableSleep => ({
  id: `s-${date}`,
  user_id: 'u1',
  date,
  source: 'health_connect',
  duration_min: durationMin,
  deep_min: null,
  light_min: null,
  rem_min: null,
  awake_min: null,
  efficiency_pct: null,
  created_at: '2026-01-01T00:00:00Z',
  ...extra,
});

describe('toRhrSeries', () => {
  it('ordena por fecha y conserva los huecos como null', () => {
    const series = toRhrSeries([
      daily('2026-01-03', 58),
      daily('2026-01-01', 55),
      daily('2026-01-02', null),
    ]);
    expect(series).toEqual([
      ['2026-01-01', 55],
      ['2026-01-02', null],
      ['2026-01-03', 58],
    ]);
  });

  it('descarta valores no finitos', () => {
    expect(toRhrSeries([daily('2026-01-01', Number.NaN)])).toEqual([['2026-01-01', null]]);
  });

  it('un null no pisa un valor real del mismo día', () => {
    const series = toRhrSeries([daily('2026-01-01', 55), daily('2026-01-01', null)]);
    expect(series).toEqual([['2026-01-01', 55]]);
  });
});

describe('toSleepHoursSeries', () => {
  it('convierte minutos a horas con un decimal', () => {
    expect(toSleepHoursSeries([sleep('2026-01-01', 450)])).toEqual([['2026-01-01', 7.5]]);
  });

  it('trata duraciones nulas o no positivas como hueco', () => {
    expect(
      toSleepHoursSeries([
        sleep('2026-01-01', null),
        sleep('2026-01-02', 0),
        sleep('2026-01-03', -30),
      ]),
    ).toEqual([
      ['2026-01-01', null],
      ['2026-01-02', null],
      ['2026-01-03', null],
    ]);
  });
});

describe('toNightlyHours', () => {
  it('solo incluye noches con sueño y las ordena', () => {
    expect(
      toNightlyHours([
        sleep('2026-01-02', 480),
        sleep('2026-01-01', null),
        sleep('2026-01-03', 420),
      ]),
    ).toEqual([7, 8]);
  });
});

describe('toRestNight', () => {
  it('pasa el porcentaje de eficiencia a proporción', () => {
    const night = sleep('2026-01-01', 450, { efficiency_pct: 92, deep_min: 80, rem_min: 95 });
    expect(toRestNight(night)).toEqual({
      totalSleepMin: 450,
      efficiency: 0.92,
      deepMin: 80,
      remMin: 95,
    });
  });

  it('no inventa eficiencia fuera de rango', () => {
    const night = sleep('2026-01-01', 450, { efficiency_pct: 140 });
    expect(toRestNight(night).efficiency).toBeNull();
  });

  it('deja null lo que no hay', () => {
    expect(toRestNight(sleep('2026-01-01', null))).toEqual({
      totalSleepMin: null,
      efficiency: null,
      deepMin: null,
      remMin: null,
    });
  });
});

describe('toDebtSeries', () => {
  it('devuelve minutos, no horas', () => {
    expect(toDebtSeries([sleep('2026-01-01', 450)])).toEqual([['2026-01-01', 450]]);
  });
});

describe('toReadinessDays', () => {
  it('une días diarios y días con esfuerzo, ordenados', () => {
    const effort = new Map([
      ['2026-01-02', 40],
      ['2026-01-04', 70],
    ]);
    const days = toReadinessDays([daily('2026-01-01', 55), daily('2026-01-03', null)], effort);
    expect(days).toEqual([
      { day: '2026-01-01', rhr: 55, hrv: null, resp: null, effort: null },
      { day: '2026-01-02', rhr: null, hrv: null, resp: null, effort: 40 },
      { day: '2026-01-03', rhr: null, hrv: null, resp: null, effort: null },
      { day: '2026-01-04', rhr: null, hrv: null, resp: null, effort: 70 },
    ]);
  });

  it('sin filas diarias ni esfuerzo devuelve vacío', () => {
    expect(toReadinessDays([], new Map())).toEqual([]);
  });
});
