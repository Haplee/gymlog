/**
 * Penalización por fatiga intra-sesión.
 *
 * Cuando el mismo grupo muscular ya acumula series dentro de la sesión, la
 * carga que se sugiere para el ejercicio siguiente baja: ese músculo llega
 * fatigado y ahí la subida cuesta más de lo que cuesta en fresco.
 *
 * El tope es del 10 % y no se aplica durante las primeras sesiones con el
 * esquema: en esas el volumen todavía no dice nada sobre cómo responde ese
 * grupo muscular.
 */

export const MAX_FATIGUE_PENALTY = 0.1;
export const MIN_SETS_FOR_FATIGUE = 3;
export const RAMP_UP_SESSIONS = 3;

export function calculateFatiguePenalty(
  priorSetsSameMuscle: number,
  sessionCount?: number,
): number {
  if (priorSetsSameMuscle < MIN_SETS_FOR_FATIGUE) return 0;
  if ((sessionCount ?? RAMP_UP_SESSIONS) < RAMP_UP_SESSIONS) return 0;

  const raw = (priorSetsSameMuscle - 2) * 0.025; // 3→0.025, 4→0.05, 5→0.075, 6→0.10
  const penalty = Math.min(MAX_FATIGUE_PENALTY, Math.max(0, raw));
  return Math.floor(penalty * 1000) / 1000; // floor 3 decimales (subestimar)
}
