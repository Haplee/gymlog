// Claves de idempotencia y reintento de red compartidos por guardado e
// importaciones.
//
// Una clave identifica una **operación**, no un contenido: se genera antes del
// primer intento y se reutiliza en todos los reintentos. El servidor la usa para
// devolver el resultado original (o rechazar la reutilización con otro
// contenido), así que el cliente nunca debe regenerarla entre dos intentos del
// mismo envío. Para una operación nueva, una clave nueva.

import { isNetworkError } from './networkError';

/** UUID v4 para una operación lógica nueva. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // WebViews antiguos sin `randomUUID`. No hace falta fuerza criptográfica
  // (la clave va firmada por la sesión y aislada por usuario), pero sí evitar
  // colisiones: 122 bits aleatorios como en un UUID v4.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * ¿El servidor rechazó la clave porque ya se usó con otro contenido?
 *
 * El SQLSTATE (P0001) es el genérico de `RAISE EXCEPTION`, así que se mira el
 * mensaje que fija el contrato. Reintentar con la misma clave no lo arregla:
 * es un fallo definitivo y debe distinguirse de un error de validación.
 *
 * No se exige `instanceof Error`: `supabase.rpc` devuelve `PostgrestError`, un
 * objeto plano con `message`. Si solo se mirara `instanceof Error`, el conflicto
 * real del servidor pasaría por «error genérico» y el reintento lo repetiría.
 */
export function isIdempotencyConflict(err: unknown): boolean {
  const message =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message ?? '')
      : String(err ?? '');
  return message.includes('idempotency_conflict');
}

export interface RetryOnNetworkOptions {
  /** Intentos totales, no reintentos. Por defecto 3. */
  attempts?: number;
  /** Espera entre intentos. Por defecto 250 ms y luego 500 ms. */
  delayMs?: number;
  /** Inyectable en tests para no esperar de verdad. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_DELAYS_MS = [250, 500];

/**
 * Ejecuta una operación y la reintenta solo si falla **por red**.
 *
 * Es la pieza que convierte una respuesta perdida en un no-evento: como el
 * llamador captura la clave fuera de esta función, el reintento va con la misma
 * y el servidor devuelve lo ya escrito en vez de duplicarlo. Un error del
 * servidor (validación, permisos, conflicto) no se reintenta: repetirlo daría el
 * mismo resultado y solo retrasaría el aviso al usuario.
 *
 * Si no hay conexión, no gasta intentos: el llamador puede encolar de inmediato.
 */
export async function retryOnNetwork<T>(
  operation: () => Promise<T>,
  options: RetryOnNetworkOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (attempt === attempts || offline || !isNetworkError(err)) throw err;
      const delay =
        options.delayMs ??
        DEFAULT_DELAYS_MS[Math.min(attempt - 1, DEFAULT_DELAYS_MS.length - 1)] ??
        500;
      await sleep(delay);
    }
  }
  throw lastError;
}
