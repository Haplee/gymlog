// Memoria del entrenador: lo que hace que la segunda conversación sea mejor
// que la primera.
//
// Dos reglas gobiernan este fichero:
//
//  1. El `user_id` lo pone el servidor desde el JWT. El modelo no lo ve, no lo
//     escribe y no puede escribir en la memoria de nadie más.
//  2. Un hecho es una observación sobre el usuario, no una orden. Lo que llega
//     pasa por el mismo filtro de fuera de alcance que el resto de la salida:
//     una "preferencia" de suplementación no es una preferencia, es consejo de
//     nutrición colado por la puerta de atrás.

import type { CoachMemoryFact } from './schema.ts';
import { MEMORY_FACT_MAX_CHARS, MEMORY_MAX_PER_RESPONSE, MEMORY_MAX_PER_USER } from './schema.ts';
import { OUT_OF_SCOPE } from './safety.ts';

/** Peso para ordenar de más flojo a más firme. */
const CONFIDENCE_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

/** Fila tal y como vive en `ai_coach_memory`. */
export interface StoredFact {
  id: string;
  fact: string;
  confidence: string;
  created_at: string;
}

export interface SanitizeResult {
  facts: CoachMemoryFact[];
  /** Qué se descartó y por qué. Va a los logs, nunca al usuario. */
  rejected: string[];
}

const normalize = (fact: string) => fact.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Deja los hechos en condiciones de entrar en la tabla.
 *
 * Trunca en vez de rechazar por longitud: el CHECK de 200 caracteres de la
 * migración haría fallar el INSERT entero y el usuario perdería la respuesta
 * completa por una frase demasiado larga.
 */
export function sanitizeFacts(
  incoming: CoachMemoryFact[],
  existing: { fact: string }[] = [],
): SanitizeResult {
  const rejected: string[] = [];
  const facts: CoachMemoryFact[] = [];
  const seen = new Set(existing.map((e) => normalize(e.fact)));

  for (const candidate of incoming) {
    const fact = candidate.fact.trim().slice(0, MEMORY_FACT_MAX_CHARS);
    if (!fact) {
      rejected.push('vacio');
      continue;
    }
    // Nutrición, suplementos y fármacos no se recuerdan ni disfrazados de hecho.
    if (OUT_OF_SCOPE.test(fact)) {
      rejected.push('fuera_de_alcance');
      continue;
    }
    const key = normalize(fact);
    if (seen.has(key)) {
      rejected.push('duplicado');
      continue;
    }
    seen.add(key);
    facts.push({ ...candidate, fact });
    if (facts.length >= MEMORY_MAX_PER_RESPONSE) break;
  }

  return { facts, rejected };
}

/**
 * Decide qué filas hay que sacar para que quepan `incoming` hechos nuevos sin
 * pasar del tope por usuario.
 *
 * Cae primero el de menor confianza y, a igual confianza, el más antiguo: un
 * "no me gusta el press militar" flojo de hace tres meses estorba menos que una
 * lesión declarada con confianza alta.
 */
export function pickEvictions(existing: StoredFact[], incoming: number): string[] {
  const overflow = existing.length + incoming - MEMORY_MAX_PER_USER;
  if (overflow <= 0) return [];

  return [...existing]
    .sort((a, b) => {
      const byConfidence =
        (CONFIDENCE_RANK[a.confidence] ?? 1) - (CONFIDENCE_RANK[b.confidence] ?? 1);
      if (byConfidence !== 0) return byConfidence;
      return a.created_at.localeCompare(b.created_at);
    })
    .slice(0, overflow)
    .map((f) => f.id);
}

/** Cliente mínimo que necesita `persistFacts`. Así el test no monta Supabase. */
export interface MemoryClient {
  listFacts(userId: string): Promise<StoredFact[]>;
  deleteFacts(userId: string, ids: string[]): Promise<void>;
  insertFacts(userId: string, facts: CoachMemoryFact[]): Promise<void>;
}

export interface PersistResult {
  inserted: number;
  evicted: number;
  rejected: string[];
}

/**
 * Guarda los hechos nuevos respetando tope y duplicados.
 *
 * `userId` es un parámetro del servidor, no un campo del modelo: llega desde el
 * JWT verificado en `index.ts` y no hay otro camino para entrar aquí.
 */
export async function persistFacts(
  client: MemoryClient,
  userId: string,
  incoming: CoachMemoryFact[],
): Promise<PersistResult> {
  if (incoming.length === 0) return { inserted: 0, evicted: 0, rejected: [] };

  const existing = await client.listFacts(userId);
  const { facts, rejected } = sanitizeFacts(incoming, existing);
  if (facts.length === 0) return { inserted: 0, evicted: 0, rejected };

  const evictions = pickEvictions(existing, facts.length);
  if (evictions.length > 0) await client.deleteFacts(userId, evictions);
  await client.insertFacts(userId, facts);

  return { inserted: facts.length, evicted: evictions.length, rejected };
}
