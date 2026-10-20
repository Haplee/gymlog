import type { Json } from '@/types/database.types';

/**
 * Convierte un valor del dominio a `Json` para columnas jsonb y argumentos RPC.
 *
 * `JSON.stringify` + `JSON.parse` es exactamente lo que supabase-js hace con el
 * payload antes de mandarlo por la red: Postgres no recibe nada más. El
 * resultado es de verdad un `Json` (los tipos del dominio no necesitan firmas
 * de índice sólo para ser almacenables como jsonb) y `undefined` desaparece
 * igual que en el wire, así que el comportamiento en el servidor no cambia.
 */
export function toJson<T>(value: T): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
