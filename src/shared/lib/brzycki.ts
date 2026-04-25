/**
 * Calcula el 1RM (una repetición máxima) usando la fórmula de Brzycki
 * @param weight - Peso en kg
 * @param reps - Repeticiones (1-36)
 * @returns 1RM estimado en kg, 0 si los valores son inválidos
 */
export function calcular1RM(weight: number, reps: number): number {
  if (!weight || !reps || weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight / (1.0278 - 0.0278 * reps);
}
