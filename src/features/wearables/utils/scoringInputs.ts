// Adaptadores entre las filas que guarda GymLog (wearable_daily / wearable_sleep)
// y las series [día, valor] que espera la capa de scoring. Aquí no se decide nada:
// solo se traduce la forma. Un día sin medición es null, nunca una media inventada.
import { round1 } from '@shared/lib/scoring/sleep';
import type { ReadinessDay } from '@shared/lib/scoring/readiness';
import type { WearableDaily, WearableSleep } from '../types';

/** Serie cronológica ascendente: valor null = día presente sin medición. */
export type ScoringSeries = [string, number | null][];

/** Forma que consume `restFromTotals`: minutos y proporciones, no porcentajes. */
export interface RestNightInput {
  totalSleepMin: number | null;
  efficiency: number | null;
  deepMin: number | null;
  remMin: number | null;
}

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const positiveOrNull = (value: number | null | undefined): number | null =>
  isFiniteNumber(value) && value > 0 ? value : null;

/**
 * Agrupa por fecha y ordena. Si hay varias filas del mismo día (varias fuentes),
 * gana el último valor válido; un null nunca pisa a un valor real.
 */
function collectSeries<T extends { date: string }>(
  rows: readonly T[],
  pick: (row: T) => number | null,
): ScoringSeries {
  const byDate = new Map<string, number | null>();
  for (const row of rows) {
    const value = pick(row);
    const previous = byDate.get(row.date);
    if (previous === undefined || previous === null || value !== null) {
      byDate.set(row.date, value);
    }
  }
  return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** FC en reposo por día, en lpm. */
export function toRhrSeries(daily: readonly WearableDaily[]): ScoringSeries {
  return collectSeries(daily, (row) => (isFiniteNumber(row.resting_hr) ? row.resting_hr : null));
}

/** Horas de sueño por noche, redondeadas a 1 decimal. */
export function toSleepHoursSeries(sleep: readonly WearableSleep[]): ScoringSeries {
  return collectSeries(sleep, (row) => {
    const minutes = positiveOrNull(row.duration_min);
    return minutes === null ? null : round1(minutes / 60);
  });
}

/** Horas de sueño de las noches con dato, para `sleepConsistency`. */
export function toNightlyHours(sleep: readonly WearableSleep[]): number[] {
  return sleep
    .map((row) => positiveOrNull(row.duration_min))
    .filter((minutes): minutes is number => minutes !== null)
    .map((minutes) => round1(minutes / 60))
    .sort((a, b) => a - b);
}

/** Última noche en la forma que espera `restFromTotals`. */
export function toRestNight(night: WearableSleep): RestNightInput {
  const efficiencyPct = night.efficiency_pct;
  const efficiency =
    isFiniteNumber(efficiencyPct) && efficiencyPct >= 0 && efficiencyPct <= 100
      ? efficiencyPct / 100
      : null;

  return {
    totalSleepMin: positiveOrNull(night.duration_min),
    efficiency,
    deepMin: isFiniteNumber(night.deep_min) && night.deep_min >= 0 ? night.deep_min : null,
    remMin: isFiniteNumber(night.rem_min) && night.rem_min >= 0 ? night.rem_min : null,
  };
}

/**
 * Minutos dormidos por noche para `ledger` / `debtSeries`. Ojo: son minutos, no
 * horas; el ledger calcula la deuda en minutos.
 */
export function toDebtSeries(sleep: readonly WearableSleep[]): ScoringSeries {
  return collectSeries(sleep, (row) => positiveOrNull(row.duration_min));
}

/**
 * Filas diarias para `readiness.evaluate`: une los días con fila diaria y los días
 * con esfuerzo. GymLog no guarda HRV ni respiración, así que van a null.
 */
export function toReadinessDays(
  daily: readonly WearableDaily[],
  effortByDay: ReadonlyMap<string, number>,
): ReadinessDay[] {
  const days = new Set<string>(effortByDay.keys());
  for (const row of daily) days.add(row.date);

  const rhrByDay = new Map<string, number | null>();
  for (const row of daily) {
    const value = isFiniteNumber(row.resting_hr) ? row.resting_hr : null;
    const previous = rhrByDay.get(row.date);
    if (previous === undefined || previous === null || value !== null) {
      rhrByDay.set(row.date, value);
    }
  }

  return [...days]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((day) => ({
      day,
      rhr: rhrByDay.get(day) ?? null,
      hrv: null,
      resp: null,
      effort: effortByDay.get(day) ?? null,
    }));
}
