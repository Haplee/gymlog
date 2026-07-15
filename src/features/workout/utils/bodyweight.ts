import type { BodyMeasurement } from '@shared/api/queries';

/**
 * Peso corporal vigente en una fecha: la medición con peso más reciente cuya
 * fecha sea ≤ la fecha dada. Devuelve null si no hay ninguna.
 */
export function bodyWeightAtDate(
  measurements: Pick<BodyMeasurement, 'date' | 'weight_kg'>[],
  date: string,
): number | null {
  let best: { date: string; weight_kg: number } | null = null;
  for (const m of measurements) {
    if (m.weight_kg == null) continue;
    if (m.date > date) continue;
    if (!best || m.date > best.date) best = { date: m.date, weight_kg: m.weight_kg };
  }
  return best?.weight_kg ?? null;
}

/**
 * Volumen estimado de una serie de peso corporal: (peso corporal + lastre) × reps.
 * Si no hay peso corporal, usa solo el lastre (que puede ser 0).
 */
export function bodyweightSetVolume(
  bodyWeightKg: number | null,
  addedLoadKg: number,
  reps: number,
): number {
  const base = (bodyWeightKg ?? 0) + Math.max(0, addedLoadKg);
  return base * Math.max(0, reps);
}

/** Días transcurridos desde la última medición de peso (null si nunca). */
export function daysSinceLastWeight(
  measurements: Pick<BodyMeasurement, 'date' | 'weight_kg'>[],
  today: string,
): number | null {
  const withWeight = measurements.filter((m) => m.weight_kg != null);
  if (withWeight.length === 0) return null;
  const last = withWeight.reduce((a, b) => (a.date > b.date ? a : b));
  const ms = new Date(today).getTime() - new Date(last.date).getTime();
  return Math.floor(ms / 86_400_000);
}
