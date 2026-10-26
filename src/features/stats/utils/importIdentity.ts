// Identidad de una importación y claves derivadas para sus lotes.
//
// Una importación manual es una operación lógica: se le asigna un id nuevo al
// confirmar el fichero y todas sus escrituras derivan de él. El id no cambia
// entre reintentos de red; una segunda importación manual recibe otro, aunque
// contenga entrenos del mismo día. Así el servidor distingue «reenvío de la
// misma operación» de «el usuario volvió a importar el fichero».
//
// Las claves derivadas no son firmas ni aleatorias: son un espacio de nombres
// determinista dentro de la importación. La garantía frente a duplicados la da
// el índice único del servidor, no esta función.

import { newIdempotencyKey } from '@shared/lib/idempotency';

const FNV_OFFSET_128 = 0x6c62272e07bb014262b821756295c58dn;
const FNV_PRIME_128 = 0x0000000001000000000000000000013bn;
const MASK_128 = (1n << 128n) - 1n;

/** Id nuevo para una importación manual. Se genera antes de la primera escritura. */
export function newImportId(): string {
  return newIdempotencyKey();
}

/**
 * Clave determinista de un lote dentro de una importación.
 *
 * FNV-1a de 128 bits sobre `importId` + `scope`, con formato UUID. No hace falta
 * resistencia criptográfica: la clave va dentro de la sesión del usuario y el
 * alcance es una importación. Sí hace falta que sea estable entre reintentos y
 * distinta entre ámbitos (`workout:2026-01-05`, `cardio:3`).
 */
export function deriveImportKey(importId: string, scope: string): string {
  const input = `${importId}\u001f${scope}`;
  let hash = FNV_OFFSET_128;

  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * FNV_PRIME_128) & MASK_128;
  }

  const hex = hash.toString(16).padStart(32, '0');
  // Versión 4 y variante RFC 4122 para que sea un UUID válido para Postgres.
  const variant = ((parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
