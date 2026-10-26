// Turno para las importaciones del historial.
//
// Dos importaciones a la vez (dos pestañas abiertas, o dos ficheros seguidos en
// la misma) calculan su «qué existe ya» con la misma foto y escriben encima: el
// dedupe por (fecha, ejercicio, set_num) no ve la escritura de la otra y las dos
// insertan lo mismo. La base tampoco lo impide, porque `workout_sets` no tiene
// un unique sobre esa terna; la atomicidad vive dentro de cada RPC, no entre
// dos importaciones.
//
// La sección crítica empieza antes de leer las claves existentes y termina al
// insertar la última serie: por eso el que espera vuelve a leer y encuentra lo
// que escribió el anterior.

const LOCK_NAME = 'gymlog-history-import';

/** Cola de la pestaña actual, para navegadores sin Web Locks. */
let localQueue: Promise<unknown> = Promise.resolve();

function hasWebLocks(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function';
}

/**
 * Ejecuta `task` con el turno de importación tomado.
 *
 * Con Web Locks el cerrojo es por origen: abarca todas las pestañas. Sin Web
 * Locks (WebView antiguo) solo se puede garantizar el turno dentro de la
 * pestaña; entre pestañas queda el dedupe contra la base, que ya se consulta al
 * empezar, y la limitación se documenta en el informe.
 */
export function withImportLock<T>(task: () => Promise<T>): Promise<T> {
  if (hasWebLocks()) {
    return navigator.locks.request(LOCK_NAME, () => task());
  }

  // Si la anterior falló, la siguiente debe correr igual: de ahí el `then` con
  // el mismo manejador en los dos huecos.
  const run = localQueue.then(task, task);
  localQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
