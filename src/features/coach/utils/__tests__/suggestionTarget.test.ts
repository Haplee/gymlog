import { describe, it, expect } from 'vitest';
import { routeForSuggestion, readSuggestionFromState } from '../suggestionTarget';
import type { CoachSuggestion, SuggestionKind } from '../../types';

const suggestion = (over: Partial<CoachSuggestion> = {}): CoachSuggestion => ({
  id: 'sug-1',
  kind: 'load',
  exercise_name: 'Press banca',
  action: 'Sube a 82,5 kg',
  rationale: 'Vas sobrado',
  confidence: 'high',
  ...over,
});

describe('routeForSuggestion', () => {
  it('lleva a la pantalla de entreno lo que se cambia serie a serie', () => {
    expect(routeForSuggestion('load')).toBe('/');
    expect(routeForSuggestion('rest')).toBe('/');
    expect(routeForSuggestion('exercise_swap')).toBe('/');
  });

  it('lleva a rutinas lo que se cambia a nivel de plan semanal', () => {
    expect(routeForSuggestion('volume')).toBe('/routines');
    expect(routeForSuggestion('frequency')).toBe('/routines');
    expect(routeForSuggestion('deload')).toBe('/routines');
  });

  it('cubre todos los tipos: uno nuevo sin destino sería un botón que no lleva a ningún sitio', () => {
    const kinds: SuggestionKind[] = [
      'load',
      'volume',
      'frequency',
      'deload',
      'rest',
      'exercise_swap',
    ];
    for (const kind of kinds) {
      expect(routeForSuggestion(kind), kind).toMatch(/^\//);
    }
  });
});

describe('readSuggestionFromState', () => {
  it('devuelve la sugerencia cuando viene en el estado del router', () => {
    const s = suggestion();
    expect(readSuggestionFromState({ coachSuggestion: s })).toEqual(s);
  });

  it('devuelve null en una navegación normal, que es el caso habitual', () => {
    expect(readSuggestionFromState(null)).toBeNull();
    expect(readSuggestionFromState(undefined)).toBeNull();
    expect(readSuggestionFromState({})).toBeNull();
    expect(readSuggestionFromState({ otraCosa: 1 })).toBeNull();
  });

  it('no se fía de un estado con forma equivocada', () => {
    // El estado del router lo puede poner cualquier navegación, incluida una
    // restaurada del historial: sin `action` no hay nada que enseñar.
    expect(readSuggestionFromState({ coachSuggestion: 'texto suelto' })).toBeNull();
    expect(readSuggestionFromState({ coachSuggestion: { kind: 'load' } })).toBeNull();
  });
});
