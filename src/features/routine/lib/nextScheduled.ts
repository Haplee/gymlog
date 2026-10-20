// Aviso del próximo cambio de rutina programado. Era un IIFE dentro de
// RoutinePage; suelto se puede probar con calendarios de una sola línea y sin
// arrastrar el store (y con él, `window.localStorage`).
import type { Routine } from '@features/routine/stores/routineStore';

/**
 * Siguiente cambio del calendario: la fecha futura más cercana que no sea la
 * rutina que ya está activa. Es lo único del calendario que interesa cuando no
 * se está eligiendo rutina.
 *
 * La rutina activa se excluye a propósito: avisar de que «va a entrar» la que
 * ya está puesta no dice nada. Si la rutina programada ya no existe, se
 * devuelve `null` en vez de un nombre vacío.
 *
 * @param today hoy en yyyy-mm-dd y hora local; se pide en vez de calcularlo
 *   para que la función no dependa del reloj.
 */
export function computeNextScheduled(
  schedule: Record<string, string>,
  activeRoutineId: string | null,
  routines: readonly Routine[],
  today: string,
): { name: string; date: string } | null {
  const upcoming = Object.entries(schedule)
    .filter(([id, date]) => date > today && id !== activeRoutineId)
    .sort((a, b) => a[1].localeCompare(b[1]))[0];
  if (!upcoming) return null;

  const routine = routines.find((r) => r.id === upcoming[0]);
  return routine ? { name: routine.name, date: upcoming[1] } : null;
}
