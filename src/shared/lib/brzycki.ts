/**
 * Repeticiones por encima de las cuales una estimación de 1RM deja de decir algo
 * sobre la fuerza máxima y pasa a hablar de resistencia.
 *
 * Las fórmulas submáximas (Brzycki, Epley, Lombardi) coinciden bastante a pocas
 * repeticiones y divergen en dos dígitos según suben. Una serie de 20 no permite
 * afirmar cuánto levantas a una: el número sale, pero es humo.
 *
 * **Es un umbral de presentación, no de cálculo.** `calcular1RM` sigue
 * respondiendo por encima del límite a propósito: la detección de estancamiento
 * y la de récords comparan series entre sí, y ahí lo que importa es que la
 * métrica sea consistente, no que sea un 1RM creíble. Quien pinta el número al
 * usuario es quien debe avisar.
 */
export const REPS_MAX_FIABLE_1RM = 12;

/** ¿La estimación de 1RM a partir de estas repeticiones es defendible? */
export function es1RMFiable(reps: number): boolean {
  return Number.isFinite(reps) && reps >= 1 && reps <= REPS_MAX_FIABLE_1RM;
}

/**
 * Calcula el 1RM (una repetición máxima) usando la fórmula de Brzycki.
 * Reps clamped to [1, 36] (formula breaks beyond 36 reps).
 *
 * Para saber si el resultado es presentable al usuario, ver `es1RMFiable`.
 */
export function calcular1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  const clamped = Math.min(36, Math.max(1, Math.floor(reps)));
  if (clamped === 1) return weight;
  return weight / (1.0278 - 0.0278 * clamped);
}
