/**
 * Disponibilidad para entrenar a partir de los datos del wearable.
 *
 * Modula la sugerencia de carga del motor de autorregulación: dormir poco o
 * tener la frecuencia cardiaca de reposo alta respecto a la propia línea base
 * son señales razonables de recuperación incompleta.
 *
 * La referencia de FC ya no es una media simple de días sueltos: se calcula con
 * la línea base EWMA de `@shared/lib/scoring` (robusta a valores extremos). El
 * resto del contrato se mantiene igual que antes, incluidos los umbrales
 * efectivos y las claves i18n, para no alterar las sugerencias que ve el usuario.
 *
 * Regla dura: **sin datos no se inventa nada**. Si el usuario no tiene wearable
 * conectado, `computeReadiness` devuelve `null` y la sugerencia sale intacta.
 */

import { deviation, foldHistory, isUsable, restingHRCfg } from '@shared/lib/scoring/baselines';
import { forRest, readiness as readinessConfidence } from '@shared/lib/scoring/confidence';
import {
  defaultSleepNeedHours,
  ledger,
  restFromTotals,
  sleepConsistency,
} from '@shared/lib/scoring/sleep';
import type { ScoreConfidence } from '@shared/lib/scoring/types';
import type { WearableDaily, WearableSleep } from '../types';
import { toDebtSeries, toNightlyHours, toRestNight, toRhrSeries } from './scoringInputs';

/** Sueño medio por debajo del cual se recomienda no subir carga (minutos). */
export const LOW_SLEEP_MIN = 360; // 6 h
/** Exceso de FC de reposo sobre la línea base que enciende el aviso (bpm). */
export const HIGH_RHR_DELTA = 7;
/** Deuda acumulada a partir de la cual también se frena la carga (minutos). */
export const SLEEP_DEBT_HOLD_MIN = 60;
/** Score de descanso por debajo del cual la señal queda en vigilancia. */
export const LOW_REST_SCORE = 50;
/** Consistencia por debajo de la cual la señal queda en vigilancia. */
export const LOW_CONSISTENCY = 0.7;
/** Días mínimos con dato para que una media sea utilizable. */
const MIN_DAYS = 3;
/** Ventana reciente que se evalúa. */
const RECENT_DAYS = 7;
/** Ventana previa que hace de línea base de FC de reposo. */
const BASELINE_DAYS = 30;
/** Ventana de noches que mira la consistencia. */
const CONSISTENCY_NIGHTS = 28;

export type ReadinessLevel = 'low' | 'normal';
export type ReadinessFlag = 'good' | 'neutral' | 'watch' | 'bad';

/** Detalle de una señal para la UI. Solo se emite si la señal tiene dato. */
export interface ReadinessSignal {
  key: 'sleep' | 'sleepDebt' | 'rest' | 'consistency' | 'restingHr';
  flag: ReadinessFlag;
  value: number;
  /** Umbral o línea base con la que se compara, si aplica. */
  reference: number | null;
  /** z-score frente a la línea base; solo en FC de reposo. */
  z?: number;
}

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
  /** Detalle por señal. */
  signals: ReadinessSignal[];
  /** Confianza del cálculo según cuántos datos sostienen la referencia. */
  confidence: ScoreConfidence;
  /** Deuda de sueño acumulada en minutos; `null` con menos de `MIN_DAYS` noches. */
  sleepDebtMin: number | null;
  /** Score de descanso 0-100 de la última noche; `null` sin eficiencia registrada. */
  restScore: number | null;
  /** Consistencia del sueño en [0, 1]; `null` con menos de 3 noches. */
  sleepConsistency: number | null;
}

const CONFIDENCE_RANK: Record<ScoreConfidence, number> = {
  calibrating: 0,
  building: 1,
  solid: 2,
};

/** La peor confianza de las señales presentes manda: si una está verde, no se sube. */
function worstConfidence(values: (ScoreConfidence | null)[]): ScoreConfidence {
  const present = values.filter((v): v is ScoreConfidence => v !== null);
  if (present.length === 0) return 'calibrating';
  return present.reduce((worst, value) =>
    CONFIDENCE_RANK[value] < CONFIDENCE_RANK[worst] ? value : worst,
  );
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const isValid = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value > 0;

const byDateAsc = <T extends { date: string }>(list: readonly T[]): T[] =>
  list.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

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
  const rhrSeries = toRhrSeries(daily ?? []);
  const sleepSeries = toDebtSeries(sleep ?? []);

  const recentRhr = rhrSeries
    .slice(-RECENT_DAYS)
    .map(([, value]) => value)
    .filter(isValid);
  const avgRestingHr = recentRhr.length >= MIN_DAYS ? mean(recentRhr) : null;

  // Línea base: los días anteriores a la ventana reciente, no el histórico entero
  // (si no, una mala racha larga se compara consigo misma y nunca salta).
  const baselineValues = rhrSeries
    .slice(-(RECENT_DAYS + BASELINE_DAYS), -RECENT_DAYS)
    .map(([, value]) => value);
  const rhrBaseline = foldHistory(baselineValues, restingHRCfg);
  const hasRhrBaseline = isUsable(rhrBaseline);
  const baselineRestingHr = hasRhrBaseline ? rhrBaseline.baseline : null;

  const recentSleep = sleepSeries
    .slice(-RECENT_DAYS)
    .map(([, value]) => value)
    .filter(isValid);
  const avgSleepMin = recentSleep.length >= MIN_DAYS ? mean(recentSleep) : null;

  const sortedSleep = byDateAsc(sleep ?? []);
  const latestNight = sortedSleep.filter((night) => isValid(night.duration_min)).at(-1) ?? null;

  const consistency = sleepConsistency(toNightlyHours(sleep ?? []).slice(-CONSISTENCY_NIGHTS));
  const restScore = latestNight ? restFromTotals(toRestNight(latestNight), consistency) : null;

  const debt = ledger(sleepSeries, defaultSleepNeedHours);
  const sleepDebtMin = debt.nightCount >= MIN_DAYS ? debt.magnitudeMin : null;

  // Sin ninguna señal utilizable no hay nada que decir.
  if (avgSleepMin === null && avgRestingHr === null) return null;

  const sleepLow = avgSleepMin !== null && avgSleepMin < LOW_SLEEP_MIN;
  const debtHigh = sleepDebtMin !== null && sleepDebtMin > SLEEP_DEBT_HOLD_MIN;
  const rhrDeviation =
    avgRestingHr !== null && hasRhrBaseline ? deviation(avgRestingHr, rhrBaseline) : null;
  const rhrHigh = rhrDeviation !== null && rhrDeviation.delta > HIGH_RHR_DELTA;

  const signals: ReadinessSignal[] = [];

  if (avgSleepMin !== null) {
    signals.push({
      key: 'sleep',
      flag: sleepLow ? 'watch' : 'good',
      value: Math.round(avgSleepMin),
      reference: LOW_SLEEP_MIN,
    });
  }
  if (sleepDebtMin !== null) {
    signals.push({
      key: 'sleepDebt',
      flag: debtHigh ? 'watch' : 'good',
      value: sleepDebtMin,
      reference: SLEEP_DEBT_HOLD_MIN,
    });
  }
  if (restScore !== null) {
    signals.push({
      key: 'rest',
      flag: restScore < LOW_REST_SCORE ? 'watch' : 'good',
      value: restScore,
      reference: LOW_REST_SCORE,
    });
  }
  if (consistency !== null) {
    signals.push({
      key: 'consistency',
      flag: consistency < LOW_CONSISTENCY ? 'watch' : 'good',
      value: Math.round(consistency * 100) / 100,
      reference: LOW_CONSISTENCY,
    });
  }
  if (avgRestingHr !== null) {
    signals.push({
      key: 'restingHr',
      flag: rhrHigh ? 'watch' : hasRhrBaseline ? 'good' : 'neutral',
      value: Math.round(avgRestingHr),
      reference: baselineRestingHr === null ? null : Math.round(baselineRestingHr),
      ...(rhrDeviation ? { z: Math.round(rhrDeviation.z * 100) / 100 } : {}),
    });
  }

  let reasonKey = 'coach.readiness.ok';
  const sleepSignal = sleepLow || debtHigh;
  if (sleepSignal && rhrHigh) reasonKey = 'coach.readiness.sleep_and_hr';
  else if (sleepSignal) reasonKey = 'coach.readiness.low_sleep';
  else if (rhrHigh) reasonKey = 'coach.readiness.high_rhr';

  const low = sleepSignal || rhrHigh;

  const confidence = worstConfidence([
    avgSleepMin !== null
      ? forRest(
          latestNight !== null,
          latestNight !== null && (latestNight.deep_min !== null || latestNight.rem_min !== null),
        )
      : null,
    avgRestingHr !== null
      ? readinessConfidence(hasRhrBaseline, rhrBaseline.nValid, BASELINE_DAYS)
      : null,
  ]);

  return {
    level: low ? 'low' : 'normal',
    holdLoad: low,
    reasonKey,
    avgSleepMin: avgSleepMin === null ? null : Math.round(avgSleepMin),
    avgRestingHr: avgRestingHr === null ? null : Math.round(avgRestingHr),
    baselineRestingHr: baselineRestingHr === null ? null : Math.round(baselineRestingHr),
    signals,
    confidence,
    sleepDebtMin,
    restScore,
    sleepConsistency: consistency,
  };
}
