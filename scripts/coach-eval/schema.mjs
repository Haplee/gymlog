// Contrato de salida del entrenador IA.
//
// Vive aquí de momento porque el script de evaluación es lo primero que lo usa.
// Cuando se implemente la Fase 2, la Edge Function porta este mismo esquema a TS
// y este fichero pasa a importarlo — no al revés: el contrato lo manda la función.

import { z } from 'zod';

/** Límites de longitud en palabras. Se comprueban, no se confía en el modelo. */
export const WORD_LIMITS = {
  summary: 60,
  insightBody: 40,
  suggestionRationale: 30,
};

/**
 * JSON Schema para `response_format` / `nvext.guided_json`.
 * `additionalProperties: false` y `required` completos en todos los niveles:
 * varios proveedores rechazan el esquema si faltan, y los que no lo rechazan
 * lo cumplen peor.
 */
export const outputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'insights', 'suggestions', 'needs_professional'],
  properties: {
    summary: {
      type: 'string',
      description: `Resumen en español, máximo ${WORD_LIMITS.summary} palabras.`,
    },
    insights: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'body', 'severity'],
        properties: {
          title: { type: 'string' },
          body: {
            type: 'string',
            description: `Máximo ${WORD_LIMITS.insightBody} palabras.`,
          },
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
          rationale: {
            type: 'string',
            description: `Máximo ${WORD_LIMITS.suggestionRationale} palabras.`,
          },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    needs_professional: {
      type: 'boolean',
      description: 'true si hay dolor, lesión o cualquier señal que exija a un profesional.',
    },
  },
};

/** Validador real. El esquema del proveedor es una ayuda; esto es la red. */
export const outputSchema = z.object({
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

/** Cuenta palabras de forma tosca pero estable entre modelos. */
export const wordCount = (text) => (text ?? '').trim().split(/\s+/).filter(Boolean).length;

/** Todo el texto en prosa de una respuesta, para análisis de idioma. */
export function allProse(parsed) {
  return [
    parsed.summary,
    ...parsed.insights.flatMap((i) => [i.title, i.body]),
    ...parsed.suggestions.flatMap((s) => [s.action, s.rationale]),
  ].join(' ');
}
