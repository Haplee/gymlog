import type { WearableDaily, WearableSleep } from '../types';

/**
 * Elige qué día mostrar en el resumen de salud.
 *
 * No sirve coger sin más el más reciente: a las 00:53 el día de hoy existe con
 * 34 pasos y sin ninguna pulsación todavía, así que los tiles de frecuencia
 * cardíaca se quedaban vacíos y desaparecían de la tarjeta — el usuario veía
 * "no hay FC" cuando en realidad la tenía medida el día anterior.
 *
 * Se toma el día más reciente con datos de verdad; si ninguno los tiene, el más
 * reciente a secas (mejor mostrar poco que nada). El llamador enseña la fecha,
 * así que nunca se hace pasar el dato de ayer por el de hoy.
 */

/** Pasos por debajo de los cuales un día no se considera "empezado". */
const MIN_MEANINGFUL_STEPS = 500;

function hasRealData(d: WearableDaily): boolean {
  return d.resting_hr != null || d.avg_hr != null || (d.steps ?? 0) >= MIN_MEANINGFUL_STEPS;
}

/** @param list días ordenados de más reciente a más antiguo. */
export function pickDaily(list: WearableDaily[] | undefined): WearableDaily | undefined {
  if (!list?.length) return undefined;
  return list.find(hasRealData) ?? list[0];
}

/** Sueño de la misma noche que el día elegido; si no lo hay, el más reciente. */
export function pickSleepFor(
  daily: WearableDaily | undefined,
  list: WearableSleep[] | undefined,
): WearableSleep | undefined {
  if (!list?.length) return undefined;
  if (!daily) return list[0];
  return list.find((s) => s.date === daily.date) ?? list[0];
}
