// ¿Este error es de red o una respuesta del servidor?
//
// Vive en su propio módulo para que `saveWorkout`, el outbox y las importaciones
// compartan la misma heurística sin arrastrar IndexedDB. Antes estaba dentro de
// `workoutOutbox`, y cualquier importación que quisiera distinguir «se perdió la
// respuesta» de «el servidor dijo que no» tenía que importar la cola entera.

/**
 * Heurística: ¿el error parece de red (sin conexión / fetch fallido)?
 *
 * Un error con código SQLSTATE o PGRST es una respuesta real del servidor (la
 * petición llegó): no es de red aunque el mensaje mencione 'fetch'. Ese detalle
 * evita reintentar indefinidamente un fallo de validación que nunca va a pasar.
 */
export function isNetworkError(err: unknown): boolean {
  // `onLine === false`, no `!navigator.onLine`: en Node el objeto `navigator`
  // existe pero no expone `onLine`, y leerlo como «offline» convertiría un
  // fallo de servidor en «sin conexión» durante los tests.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === 'string' && (/^[0-9A-Z]{5}$/.test(code) || code.startsWith('PGRST'))) {
      return false;
    }
  }
  const msg = (
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message ?? '')
      : String(err ?? '')
  ).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('offline')
  );
}
