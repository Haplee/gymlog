export function calcular1RM(weight: number, reps: number): number {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight / (1.0278 - 0.0278 * reps);
}