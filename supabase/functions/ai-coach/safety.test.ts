// Tests del post-filtro determinista.
//
// Este módulo es la red que hay debajo del modelo: el banco de pruebas midió
// que llama-3.3-70b daba pauta de carga pese a un dolor de hombro declarado.
// Cada test de aquí fija una barrera que NO debe depender del prompt.
//
// Corren en Vitest (Node) sobre un módulo escrito para Deno: el import por URL
// de zod se redirige al zod del proyecto vía `alias` en vitest.config.ts.

import { describe, it, expect } from 'vitest';
import { applySafety, type SafetyContext } from './safety.ts';
import type { CoachOutput } from './schema.ts';
import { WORD_LIMITS } from './schema.ts';

/** Salida mínima válida; cada test sobrescribe solo lo que le interesa. */
function makeOutput(over: Partial<CoachOutput> = {}): CoachOutput {
  return {
    summary: 'Semana estable.',
    insights: [],
    suggestions: [],
    needs_professional: false,
    ...over,
  };
}

function makeCtx(over: Partial<SafetyContext> = {}): SafetyContext {
  return { lastWeightByExercise: {}, ...over };
}

const loadSuggestion = (over: Partial<CoachOutput['suggestions'][number]> = {}) => ({
  kind: 'load' as const,
  exercise_name: 'Press banca',
  action: 'Sube a 105 kg',
  rationale: 'Cerraste las 3 series sin fallo.',
  confidence: 'medium' as const,
  ...over,
});

describe('applySafety · banderas rojas', () => {
  it('fuerza la derivación cuando el usuario declara dolor, aunque el modelo diga que no', () => {
    const { output, corrections } = applySafety(
      makeOutput({ needs_professional: false }),
      makeCtx({ userText: 'me duele el hombro al empujar' }),
    );

    expect(output.needs_professional).toBe(true);
    expect(corrections).toContain('red_flag_forzada');
  });

  it('no anota corrección si el modelo ya había derivado por su cuenta', () => {
    const { output, corrections } = applySafety(
      makeOutput({ needs_professional: true }),
      makeCtx({ userText: 'tengo una molestia en la rodilla' }),
    );

    expect(output.needs_professional).toBe(true);
    expect(corrections).not.toContain('red_flag_forzada');
  });

  it('no deriva si no hay señal médica en lo que escribió el usuario', () => {
    const { output } = applySafety(
      makeOutput(),
      makeCtx({ userText: 'quiero subir en press banca' }),
    );

    expect(output.needs_professional).toBe(false);
  });

  it('detecta la señal médica con tilde y con variantes flexionadas', () => {
    for (const texto of ['noto una lesión', 'sigo lesionado', 'tengo tendinitis']) {
      const { output } = applySafety(makeOutput(), makeCtx({ userText: texto }));
      expect(output.needs_professional).toBe(true);
    }
  });
});

describe('applySafety · derivación suprime la carga', () => {
  // Este es exactamente el fallo medido en el banco de pruebas.
  it('elimina toda pauta de carga cuando hay dolor declarado', () => {
    const { output, corrections } = applySafety(
      makeOutput({ suggestions: [loadSuggestion()] }),
      makeCtx({ userText: 'me duele el hombro' }),
    );

    expect(output.suggestions).toHaveLength(0);
    expect(corrections).toContain('carga_suprimida_por_derivacion');
  });

  it('conserva las sugerencias que no son de carga al derivar', () => {
    const descanso = loadSuggestion({ kind: 'rest', action: 'Descansa 48 h', exercise_name: null });
    const { output } = applySafety(
      makeOutput({ suggestions: [loadSuggestion(), descanso] }),
      makeCtx({ userText: 'me duele el hombro' }),
    );

    expect(output.suggestions).toHaveLength(1);
    expect(output.suggestions[0].kind).toBe('rest');
  });
});

describe('applySafety · tope del 10% sobre el último peso', () => {
  it('descarta el salto que supera el 10%', () => {
    const { output, corrections } = applySafety(
      makeOutput({ suggestions: [loadSuggestion({ action: 'Sube a 120 kg' })] }),
      makeCtx({ lastWeightByExercise: { 'Press banca': 100 } }),
    );

    expect(output.suggestions).toHaveLength(0);
    expect(corrections).toContain('salto_excesivo:Press banca');
  });

  it('acepta el salto que queda justo en el límite', () => {
    const { output } = applySafety(
      makeOutput({ suggestions: [loadSuggestion({ action: 'Sube a 110 kg' })] }),
      makeCtx({ lastWeightByExercise: { 'Press banca': 100 } }),
    );

    expect(output.suggestions).toHaveLength(1);
  });

  it('no bloquea si no hay peso previo con el que comparar', () => {
    const { output } = applySafety(
      makeOutput({ suggestions: [loadSuggestion({ action: 'Sube a 500 kg' })] }),
      makeCtx({ lastWeightByExercise: {} }),
    );

    expect(output.suggestions).toHaveLength(1);
  });

  it('no bloquea si la acción no menciona un peso: sin dato no se juzga', () => {
    const { output } = applySafety(
      makeOutput({ suggestions: [loadSuggestion({ action: 'Sube un poco el peso' })] }),
      makeCtx({ lastWeightByExercise: { 'Press banca': 100 } }),
    );

    expect(output.suggestions).toHaveLength(1);
  });

  it('lee el peso con coma decimal', () => {
    const { output } = applySafety(
      makeOutput({ suggestions: [loadSuggestion({ action: 'Sube a 102,5 kg' })] }),
      makeCtx({ lastWeightByExercise: { 'Press banca': 100 } }),
    );

    expect(output.suggestions).toHaveLength(1);
  });
});

describe('applySafety · nutrición y farmacología fuera de alcance', () => {
  it('limpia el summary y lo anota', () => {
    const { output, corrections } = applySafety(
      makeOutput({ summary: 'Buen trabajo, toma creatina para rendir más.' }),
      makeCtx(),
    );

    expect(output.summary).not.toMatch(/creatina/i);
    expect(corrections).toContain('nutricion_en_summary');
  });

  it('borra el insight entero en vez de intentar corregirlo', () => {
    const { output, corrections } = applySafety(
      makeOutput({
        insights: [
          { title: 'Volumen', body: 'Subiste series.', severity: 'info' },
          { title: 'Dieta', body: 'Sube a 180 g de proteína.', severity: 'info' },
        ],
      }),
      makeCtx(),
    );

    expect(output.insights).toHaveLength(1);
    expect(output.insights[0].title).toBe('Volumen');
    expect(corrections).toContain('nutricion_en_insight');
  });

  it('borra la sugerencia que menciona farmacología', () => {
    const { output, corrections } = applySafety(
      makeOutput({
        suggestions: [loadSuggestion({ rationale: 'Con esteroides progresarías antes.' })],
      }),
      makeCtx(),
    );

    expect(output.suggestions).toHaveLength(0);
    expect(corrections).toContain('nutricion_en_sugerencia');
  });

  it('cae al texto por defecto si el summary queda vacío tras limpiarlo', () => {
    const { output } = applySafety(makeOutput({ summary: 'creatina' }), makeCtx());

    expect(output.summary).toBe('Sin novedades esta semana.');
  });
});

describe('applySafety · límites de longitud', () => {
  it('trunca el summary que se pasa del límite y lo anota', () => {
    const largo = Array.from({ length: WORD_LIMITS.summary + 20 }, (_, i) => `p${i}`).join(' ');
    const { output, corrections } = applySafety(makeOutput({ summary: largo }), makeCtx());

    // El «…» se pega a la última palabra, no va suelto: siguen siendo `summary`
    // tokens, con el último terminado en puntos suspensivos.
    const tokens = output.summary.split(/\s+/);
    expect(tokens).toHaveLength(WORD_LIMITS.summary);
    expect(tokens.at(-1)).toBe(`p${WORD_LIMITS.summary - 1}…`);
    expect(corrections).toContain('summary_truncado');
  });

  it('no toca el summary que ya cabe', () => {
    const { output, corrections } = applySafety(
      makeOutput({ summary: 'Semana sólida.' }),
      makeCtx(),
    );

    expect(output.summary).toBe('Semana sólida.');
    expect(corrections).not.toContain('summary_truncado');
  });

  it('trunca el cuerpo de los insights', () => {
    const largo = Array.from({ length: WORD_LIMITS.insightBody + 10 }, (_, i) => `p${i}`).join(' ');
    const { output } = applySafety(
      makeOutput({ insights: [{ title: 'T', body: largo, severity: 'info' }] }),
      makeCtx(),
    );

    expect(output.insights[0].body.endsWith('…')).toBe(true);
  });
});

describe('applySafety · no muta la entrada', () => {
  it('deja intacto el objeto original', () => {
    const original = makeOutput({ suggestions: [loadSuggestion()], needs_professional: false });
    const copia = structuredClone(original);

    applySafety(original, makeCtx({ userText: 'me duele el hombro' }));

    expect(original).toEqual(copia);
  });
});
