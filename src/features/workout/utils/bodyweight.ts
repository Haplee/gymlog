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

/**
 * ¿Es lunes esa fecha (YYYY-MM-DD)?
 *
 * Se construye la fecha por partes a propósito: `new Date('2026-08-17')` se
 * interpreta como UTC, así que en husos negativos devolvería domingo.
 */
function isMonday(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === 1;
}

/**
 * ¿Toca pedir el peso corporal? Solo los lunes.
 *
 * El peso semanal solo sirve si se compara consigo mismo, y para eso hay que
 * pesarse siempre el mismo día: el peso oscila un par de kilos entre un lunes
 * en ayunas y un sábado después de cenar. Antes bastaba con que hubieran pasado
 * 7 días, así que el día de la medición se iba corriendo por la semana y la
 * serie dejaba de ser comparable.
 *
 * Dentro del lunes basta con que no haya registro de hoy. Exigir "≥7 días"
 * volvería a desplazar la medición: registrar un martes se saltaría el lunes
 * siguiente (solo 6 días) y esperaría al otro.
 */
export function isWeightPromptDue(
  measurements: Pick<BodyMeasurement, 'date' | 'weight_kg'>[],
  today: string,
): boolean {
  if (!isMonday(today)) return false;
  const days = daysSinceLastWeight(measurements, today);
  return days === null || days >= 1;
}
