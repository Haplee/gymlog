// Normalización de las series justo antes de mandarlas al RPC.
//
// El servidor calcula la huella de idempotencia casteando cada campo numérico
// del JSON (`(s->>'rpe')::numeric`). Un campo **presente pero vacío** (`''`) no
// es un número: Postgres aborta la llamada entera con «invalid input syntax for
// type numeric» y el guardado falla sin escribir nada. La app manda `rpe: ''`
// en todas las series, así que ese `''` tumbaba **todos** los guardados.
//
// La RPC trata la clave ausente como «sin dato» (NULL), que es lo que de verdad
// significa una serie sin RPE. Aquí se quita la clave en vez de mandar `''`.

/** Lo que Postgres acepta como número; el resto se descarta como si no viniera. */
const NUMERO = /^-?\d+(\.\d+)?$/;

/**
 * Copia de las series sin los campos numéricos vacíos.
 *
 * Devuelve el mismo array si no hay nada que quitar, para no crear objetos de
 * más en cada guardado.
 */
export function toRpcSets<T extends object>(sets: T[]): T[] {
  let changed = false;

  const limpio = sets.map((set) => {
    const conRpe = set as { rpe?: string | null };
    const rpe = conRpe.rpe?.trim();
    if (rpe && NUMERO.test(rpe)) return set;
    // Sin `rpe` no hay nada que limpiar: se deja el objeto tal cual.
    if (!('rpe' in conRpe)) return set;

    const copia = { ...set };
    delete (copia as { rpe?: string | null }).rpe;
    changed = true;
    return copia;
  });

  return changed ? limpio : sets;
}
