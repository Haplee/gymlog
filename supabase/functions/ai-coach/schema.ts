// Contrato de salida del entrenador.
//
// El esquema que se manda al proveedor es una AYUDA, no una garantía: en las
// pruebas (scripts/coach-eval) hay modelos que lo rechazan con 400 y otros que
// lo aceptan y aun así devuelven JSON envuelto en texto. La garantía es Zod.

import { z } from 'https://esm.sh/zod@3.24.2';

export const WORD_LIMITS = {
  summary: 60,
  insightBody: 40,
  suggestionRationale: 30,
};

/** Tope de caracteres de un hecho de memoria. Igual que el CHECK de la tabla. */
export const MEMORY_FACT_MAX_CHARS = 200;

/** Hechos que el modelo puede pedir recordar en una sola respuesta. */
export const MEMORY_MAX_PER_RESPONSE = 3;

/** Hechos que un usuario puede acumular. Al llenarse, cae el más flojo. */
export const MEMORY_MAX_PER_USER = 50;

/**
 * Para `response_format.json_schema` / `nvext.guided_json`.
 *
 * `remember` viaja aquí y no como tool call a propósito. Con estos proveedores
 * ya cuesta arrancar JSON estructurado (medido: llama-3.3-70b rechaza
 * `json_schema` con 400 y hay que degradar a `json_object`); encima, mezclar
 * `tools` con `response_format` obliga a una segunda vuelta al proveedor por
 * cada mensaje — el doble de latencia y de cuota para escribir una frase.
 * La propiedad que importaba se conserva intacta: **`user_id` no está en este
 * esquema**, lo pone el servidor desde el JWT.
 */
export const outputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'insights', 'suggestions', 'needs_professional', 'remember'],
  properties: {
    summary: { type: 'string' },
    insights: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'body', 'severity'],
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'success', 'warning'] },
        },
      },
    },
    suggestions: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'exercise_name', 'action', 'rationale', 'confidence'],
        properties: {
          kind: {
            type: 'string',
            enum: ['load', 'volume', 'frequency', 'deload', 'rest', 'exercise_swap'],
          },
          exercise_name: { type: ['string', 'null'] },
          action: { type: 'string' },
          rationale: { type: 'string' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    needs_professional: { type: 'boolean' },
    remember: {
      type: 'array',
      maxItems: MEMORY_MAX_PER_RESPONSE,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'fact', 'confidence'],
        properties: {
          category: { type: 'string', enum: ['injury', 'preference', 'constraint', 'goal'] },
          fact: { type: 'string', maxLength: MEMORY_FACT_MAX_CHARS },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
  },
};

export const coachOutputSchema = z.object({
  summary: z.string().min(1),
  insights: z
    .array(
      z.object({
        title: z.string().min(1),
        body: z.string().min(1),
        severity: z.enum(['info', 'success', 'warning']),
      }),
    )
    .max(3),
  suggestions: z
    .array(
      z.object({
        kind: z.enum(['load', 'volume', 'frequency', 'deload', 'rest', 'exercise_swap']),
        exercise_name: z.string().nullable(),
        action: z.string().min(1),
        rationale: z.string().min(1),
        confidence: z.enum(['low', 'medium', 'high']),
      }),
    )
    .max(3),
  needs_professional: z.boolean(),
  // Opcional con defecto: cuando el proveedor degrada a `json_object` no hay
  // esquema que obligue, y una respuesta útil sin `remember` no debe caerse.
  remember: z
    .array(
      z.object({
        category: z.enum(['injury', 'preference', 'constraint', 'goal']),
        fact: z.string().min(1),
        confidence: z.enum(['low', 'medium', 'high']),
      }),
    )
    .max(MEMORY_MAX_PER_RESPONSE)
    .optional()
    .default([]),
});

export type CoachOutput = z.infer<typeof coachOutputSchema>;
export type CoachMemoryFact = CoachOutput['remember'][number];

/** Petición del cliente. `user_id` NO existe aquí a propósito: sale del JWT. */
export const requestSchema = z.object({
  mode: z.enum(['weekly', 'chat', 'exercise']),
  message: z.string().max(1000).optional(),
  exercise_name: z.string().max(200).optional(),
});

/**
 * Extrae el objeto JSON aunque venga envuelto en ```json o con texto colgando.
 * Los modelos abiertos lo hacen a menudo pese al esquema.
 */
export function extractJson(text: string): unknown | null {
  if (!text) return null;

  const candidates: string[] = [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  candidates.push(text.trim());
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* siguiente candidato */
    }
  }
  return null;
}
