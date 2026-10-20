/**
 * Ventana de sesiones que ve el motor desde la pantalla de progreso.
 *
 * La sesión de rutina consulta las sesiones de un ejercicio con
 * `groupSetsBySession` (día local, sin calentamientos, sin series sin
 * repeticiones, orden descendente y recorte a `EXERCISE_SESSION_LIMIT`). Esta
 * función reproduce exactamente esa ventana sobre las series sueltas que trae
 * la pantalla de progreso, porque el motor solo puede dar la misma respuesta si
 * le llegan los mismos datos: con la ventana anterior —día UTC, con
 * calentamientos y sin recorte— un entreno de madrugada caía en el día
 * equivocado y `detectStall` veía una sesión más que la otra pantalla.
 *
 * Lógica pura, sin React ni red, para poder probar la paridad directamente.
 */

import { toLocalDateKey } from '@shared/lib/dateKeys';
import { EXERCISE_SESSION_LIMIT } from '@shared/api/sessionGrouping';
import type { AutoRegSession, AutoRegSet } from './autoregulation';

export interface SessionWindowSet extends AutoRegSet {
  workout?: { started_at: string | null } | null;
}

/**
 * Agrupa las series de un ejercicio en sesiones por día **local** y devuelve
 * las más recientes hasta `limit`.
 */
export function toSessionWindow(
  sets: readonly SessionWindowSet[],
  limit = EXERCISE_SESSION_LIMIT,
): AutoRegSession[] {
  const byDay = new Map<string, AutoRegSession>();

  for (const s of sets) {
    const startedAt = s.workout?.started_at;
    if (!startedAt) continue;
    const parsed = new Date(startedAt);
    if (Number.isNaN(parsed.getTime())) continue;
    // Mismos filtros que la consulta de la sesión de rutina hace en SQL: sin
    // calentamientos y sin series sin reps, que no son esfuerzo comparable.
    if (s.is_warmup) continue;
    if (s.reps == null || !Number.isFinite(s.reps) || s.reps <= 0) continue;
    if (s.weight == null || !Number.isFinite(s.weight) || s.weight <= 0) continue;

    const dayKey = toLocalDateKey(parsed);
    const entry: AutoRegSet = { weight: s.weight, reps: s.reps, rir: s.rir, rpe: s.rpe };
    const session = byDay.get(dayKey);

    if (!session) {
      byDay.set(dayKey, { date: startedAt, sets: [entry] });
      continue;
    }
    session.sets.push(entry);
    // La sesión se marca con el inicio más temprano del día: es cuando empezó
    // a entrenar, no cuando guardó el último ejercicio (mismo criterio que
    // `groupSetsBySession`).
    if (startedAt.localeCompare(session.date) < 0) session.date = startedAt;
  }

  // Más reciente primero y recorte a la ventana compartida, igual que allí.
  return [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
