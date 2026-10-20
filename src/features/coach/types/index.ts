export type CoachMode = 'weekly' | 'chat' | 'exercise';

export type SuggestionKind = 'load' | 'volume' | 'frequency' | 'deload' | 'rest' | 'exercise_swap';

export interface CoachInsight {
  title: string;
  body: string;
  severity: 'info' | 'success' | 'warning';
}

export interface CoachSuggestion {
  /**
   * Id de la fila en `ai_coach_suggestions`. Puede ser `null` si la inserción
   * falló: la respuesta se muestra igual, solo que sin poder marcarla.
   */
  id: string | null;
  kind: SuggestionKind;
  exercise_name: string | null;
  action: string;
  rationale: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface CoachOutput {
  summary: string;
  insights: CoachInsight[];
  suggestions: CoachSuggestion[];
  needs_professional: boolean;
}

/** Una pregunta del usuario y lo que contestó el entrenador. */
export interface CoachTurn {
  id: string;
  question: string;
  answer: CoachOutput;
}

export interface CoachMemoryFact {
  id: string;
  category: 'injury' | 'preference' | 'constraint' | 'goal';
  fact: string;
  confidence: 'low' | 'medium' | 'high';
  created_at: string;
}

/**
 * Errores que el endpoint distingue. Cada uno tiene su mensaje en la UI: un
 * "cuota agotada" y un "el proveedor está caído" no se le cuentan igual al
 * usuario, aunque los dos sean "no ha salido".
 */
export type CoachErrorCode =
  | 'unauthorized'
  | 'consent_required'
  | 'quota_exceeded'
  | 'coach_disabled'
  | 'provider_unavailable'
  | 'invalid_output'
  | 'network'
  | 'unknown';

export class CoachError extends Error {
  code: CoachErrorCode;
  constructor(code: CoachErrorCode) {
    super(code);
    this.name = 'CoachError';
    this.code = code;
  }
}
