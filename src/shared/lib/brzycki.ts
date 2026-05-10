/**
 * Calcula el 1RM (una repetición máxima) usando la fórmula de Brzycki.
 * Reps clamped to [1, 36] (formula breaks beyond 36 reps).
 */
export function calcular1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  const clamped = Math.min(36, Math.max(1, Math.floor(reps)));
  if (clamped === 1) return weight;
  return weight / (1.0278 - 0.0278 * clamped);
}
