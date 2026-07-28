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

/** Para `response_format.json_schema` / `nvext.guided_json`. */
export const outputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'insights', 'suggestions', 'needs_professional'],
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
});

export type CoachOutput = z.infer<typeof coachOutputSchema>;

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
