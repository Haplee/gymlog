import type { CoachSuggestion, SuggestionKind } from '../types';

/** Lo que viaja en el estado del router cuando el usuario acepta una sugerencia. */
export interface CoachSuggestionNav {
  coachSuggestion: CoachSuggestion;
}

/**
 * A qué pantalla se lleva al usuario al pulsar «Aplicar».
 *
 * No se aplica nada automáticamente: se le deja delante del sitio donde ese
 * cambio se hace, con la sugerencia a la vista. Cambiar el peso de una serie
 * ocurre en la pantalla de entreno; cambiar volumen, frecuencia o meter una
 * descarga ocurre en la rutina.
 */
export function routeForSuggestion(kind: SuggestionKind): string {
  switch (kind) {
    case 'volume':
    case 'frequency':
    case 'deload':
      return '/routines';
    case 'load':
    case 'rest':
    case 'exercise_swap':
      return '/';
  }
}

/** Saca la sugerencia del estado del router, si es que viene alguna. */
export function readSuggestionFromState(state: unknown): CoachSuggestion | null {
  if (!state || typeof state !== 'object') return null;
  const candidate = (state as Partial<CoachSuggestionNav>).coachSuggestion;
  if (!candidate || typeof candidate !== 'object') return null;
  return typeof candidate.action === 'string' ? candidate : null;
}
