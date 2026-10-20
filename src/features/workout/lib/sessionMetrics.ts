// Métricas derivadas de la sesión en curso (volumen, series válidas y mejor 1RM).
// Estaban en línea dentro de WorkoutPage; aquí se pueden probar sin React.
import { calcular1RM } from '@shared/lib/brzycki';

/** Lo mínimo que necesita saberse de una fila para calcular métricas. */
export interface MetricSet {
  reps?: string;
  weight?: string;
  isWarmup?: boolean;
}

/**
 * Volumen de la sesión en kg.
 *
 * En modo peso corporal el kg introducido es lastre: el peso efectivo por rep
 * es (peso corporal vigente + lastre), igual que lo que guarda `saveWorkout`.
 */
export function computeSessionVolume(
  sets: readonly MetricSet[],
  isBodyweight: boolean,
  currentBodyWeight: number | null,
): number {
  return sets.reduce((sum, s) => {
    const r = Number(s.reps) || 0;
    const entered = Number(s.weight) || 0;
    const w = isBodyweight ? (currentBodyWeight ?? 0) + entered : entered;
    return sum + r * w;
  }, 0);
}

/**
 * Series que cuentan como hechas.
 *
 * En modo peso corporal basta con las repeticiones (el lastre es opcional); en
 * modo normal hace falta peso.
 */
export function countValidSets(sets: readonly MetricSet[], isBodyweight: boolean): number {
  return sets.filter((s) => s.reps && (isBodyweight || s.weight)).length;
}

/**
 * Mejor 1RM estimado de la sesión, excluyendo calentamientos. Pesos en kg.
 * Devuelve el peso usado y el 1RM estimado, o `null` si no hay serie válida.
 */
export function computeBestEstimate(
  sets: readonly MetricSet[],
): { weightKg: number; e1rm: number } | null {
  let best: { weightKg: number; e1rm: number } | null = null;
  for (const s of sets) {
    if (s.isWarmup) continue;
    const w = Number(s.weight);
    const r = Number(s.reps);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) continue;
    const e1rm = calcular1RM(w, r);
    if (!best || e1rm > best.e1rm) best = { weightKg: w, e1rm };
  }
  return best;
}
