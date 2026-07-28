import { describe, it, expect } from 'vitest';
import { computeReadiness } from '../readiness';
import type { WearableDaily, WearableSleep } from '../../types';

const dateKey = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

/** Afirma que el valor no es nulo y lo devuelve estrechado, sin usar `!`. */
function nn<T>(value: T | null | undefined): T {
  expect(value).not.toBeNull();
  return value as T;
}

const daily = (daysAgo: number, restingHr: number | null): WearableDaily => ({
  id: `d${daysAgo}`,
  user_id: 'u1',
  date: dateKey(daysAgo),
  source: 'health_connect',
  steps: 8000,
  distance_km: 5,
  calories: 2200,
  resting_hr: restingHr,
  avg_hr: 75,
  max_hr: 150,
  created_at: new Date().toISOString(),
});

const sleep = (daysAgo: number, durationMin: number | null): WearableSleep => ({
  id: `s${daysAgo}`,
  user_id: 'u1',
  date: dateKey(daysAgo),
  source: 'health_connect',
  duration_min: durationMin,
  deep_min: null,
  light_min: null,
  rem_min: null,
  awake_min: null,
  efficiency_pct: null,
  created_at: new Date().toISOString(),
});

/** Serie de días con la misma FC de reposo, de `from` a `to` días atrás. */
const rhrRange = (from: number, to: number, hr: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => daily(from + i, hr));

describe('computeReadiness', () => {
  it('devuelve null sin ningún dato', () => {
    expect(computeReadiness(undefined, undefined)).toBeNull();
    expect(computeReadiness([], [])).toBeNull();
  });

  it('devuelve null con menos días de los mínimos', () => {
    expect(computeReadiness([daily(1, 55)], [sleep(1, 400)])).toBeNull();
  });

  it('marca recuperación baja por dormir poco', () => {
    const r = computeReadiness(undefined, [sleep(1, 300), sleep(2, 320), sleep(3, 310)]);
    expect(r).not.toBeNull();
    expect(nn(r).level).toBe('low');
    expect(nn(r).holdLoad).toBe(true);
    expect(nn(r).reasonKey).toBe('coach.readiness.low_sleep');
    expect(nn(r).avgSleepMin).toBe(310);
  });

  it('no marca recuperación baja durmiendo bien', () => {
    const r = computeReadiness(undefined, [sleep(1, 460), sleep(2, 470), sleep(3, 450)]);
    expect(nn(r).level).toBe('normal');
    expect(nn(r).holdLoad).toBe(false);
    expect(nn(r).reasonKey).toBe('coach.readiness.ok');
  });

  it('marca recuperación baja por FC de reposo alta sobre la propia línea base', () => {
    const recent = rhrRange(0, 6, 65);
    const baseline = rhrRange(7, 25, 55);
    const r = computeReadiness([...recent, ...baseline], undefined);
    expect(nn(r).level).toBe('low');
    expect(nn(r).reasonKey).toBe('coach.readiness.high_rhr');
    expect(nn(r).avgRestingHr).toBe(65);
    expect(nn(r).baselineRestingHr).toBe(55);
  });

  it('no salta si la FC sube poco respecto a la línea base', () => {
    const r = computeReadiness([...rhrRange(0, 6, 58), ...rhrRange(7, 25, 55)], undefined);
    expect(nn(r).level).toBe('normal');
  });

  it('sin línea base no puede juzgar la FC de reposo', () => {
    const r = computeReadiness(rhrRange(0, 6, 80), undefined);
    expect(nn(r).level).toBe('normal');
    expect(nn(r).baselineRestingHr).toBeNull();
  });

  it('combina ambas señales cuando coinciden', () => {
    const r = computeReadiness(
      [...rhrRange(0, 6, 68), ...rhrRange(7, 25, 55)],
      [sleep(1, 300), sleep(2, 300), sleep(3, 300)],
    );
    expect(nn(r).reasonKey).toBe('coach.readiness.sleep_and_hr');
    expect(nn(r).holdLoad).toBe(true);
  });

  it('ignora valores nulos o absurdos', () => {
    const r = computeReadiness(undefined, [
      sleep(1, null),
      sleep(2, 0),
      sleep(3, 450),
      sleep(4, 460),
      sleep(5, 470),
    ]);
    expect(nn(r).avgSleepMin).toBe(460);
  });

  it('no depende del orden de entrada', () => {
    const list = [sleep(3, 310), sleep(1, 300), sleep(2, 320)];
    expect(computeReadiness(undefined, list)).toEqual(
      computeReadiness(undefined, [...list].reverse()),
    );
  });
});
