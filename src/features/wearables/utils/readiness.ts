/**
 * Disponibilidad para entrenar a partir de los datos del wearable.
 *
 * Modula la sugerencia de carga del motor de autorregulación: dormir poco o
 * tener la frecuencia cardiaca de reposo alta respecto a la propia línea base
 * son señales razonables de recuperación incompleta.
 *
 * Regla dura: **sin datos no se inventa nada**. Si el usuario no tiene wearable
 * conectado, `computeReadiness` devuelve `null` y la sugerencia sale intacta.
 */

import type { WearableDaily, WearableSleep } from '../types';

/** Sueño medio por debajo del cual se recomienda no subir carga (minutos). */
const LOW_SLEEP_MIN = 360; // 6 h
/** Exceso de FC de reposo sobre la línea base que enciende el aviso (bpm). */
const HIGH_RHR_DELTA = 7;
/** Días mínimos con dato para que una media sea utilizable. */
const MIN_DAYS = 3;
/** Ventana reciente que se evalúa. */
const RECENT_DAYS = 7;
/** Ventana previa que hace de línea base de FC de reposo. */
const BASELINE_DAYS = 30;

export type ReadinessLevel = 'low' | 'normal';

export interface Readiness {
  level: ReadinessLevel;
  /** Si `true`, conviene mantener carga en lugar de subirla. */
  holdLoad: boolean;
  /** Clave i18n del motivo (namespace `coach.readiness.*`). */
  reasonKey: string;
  /** Media de sueño de los últimos días, en minutos. `null` si no hay dato. */
  avgSleepMin: number | null;
  /** Media de FC de reposo reciente. `null` si no hay dato. */
  avgRestingHr: number | null;
  /** Línea base de FC de reposo del propio usuario. `null` si no hay dato. */
  baselineRestingHr: number | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Ordena de más reciente a más antiguo por `date`. */
function byDateDesc<T extends { date: string }>(list: T[]): T[] {
  return list.slice().sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Estado de recuperación derivado de sueño y FC de reposo.
 *
 * @param daily resúmenes diarios del wearable (cualquier orden)
 * @param sleep noches registradas (cualquier orden)
 * @returns `null` si no hay datos suficientes — nunca una estimación inventada
 */
export function computeReadiness(
  daily: WearableDaily[] | undefined,
  sleep: WearableSleep[] | undefined,
): Readiness | null {
  const dailySorted = byDateDesc(daily ?? []);
  const sleepSorted = byDateDesc(sleep ?? []);

  const recentSleep = sleepSorted
    .slice(0, RECENT_DAYS)
    .map((s) => s.duration_min)
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  const avgSleepMin = recentSleep.length >= MIN_DAYS ? mean(recentSleep) : null;

  const recentRhrValues = dailySorted
    .slice(0, RECENT_DAYS)
    .map((d) => d.resting_hr)
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  const avgRestingHr = recentRhrValues.length >= MIN_DAYS ? mean(recentRhrValues) : null;

  // Línea base: los días anteriores a la ventana reciente, no el histórico entero
  // (si no, una mala racha larga se compara consigo misma y nunca salta).
  const baselineValues = dailySorted
    .slice(RECENT_DAYS, BASELINE_DAYS)
    .map((d) => d.resting_hr)
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  const baselineRestingHr = baselineValues.length >= MIN_DAYS ? mean(baselineValues) : null;

  // Sin ninguna señal utilizable no hay nada que decir.
  if (avgSleepMin === null && avgRestingHr === null) return null;

  const sleepLow = avgSleepMin !== null && avgSleepMin < LOW_SLEEP_MIN;
  const rhrHigh =
    avgRestingHr !== null &&
    baselineRestingHr !== null &&
    avgRestingHr - baselineRestingHr > HIGH_RHR_DELTA;

  let reasonKey = 'coach.readiness.ok';
  if (sleepLow && rhrHigh) reasonKey = 'coach.readiness.sleep_and_hr';
  else if (sleepLow) reasonKey = 'coach.readiness.low_sleep';
  else if (rhrHigh) reasonKey = 'coach.readiness.high_rhr';

  const low = sleepLow || rhrHigh;

  return {
    level: low ? 'low' : 'normal',
    holdLoad: low,
    reasonKey,
    avgSleepMin: avgSleepMin === null ? null : Math.round(avgSleepMin),
    avgRestingHr: avgRestingHr === null ? null : Math.round(avgRestingHr),
    baselineRestingHr: baselineRestingHr === null ? null : Math.round(baselineRestingHr),
  };
}
