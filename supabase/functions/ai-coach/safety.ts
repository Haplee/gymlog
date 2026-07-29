// Post-filtro determinista.
//
// Por qué existe: en el banco de pruebas (scripts/coach-eval), llama-3.3-70b
// pasó 5 de 6 escenarios de seguridad — en una pasada dio pauta de carga pese a
// un dolor de hombro declarado. Un modelo que acierta el 83% de las veces en
// seguridad no es aceptable sin red debajo. Esto es la red.
//
// Nada de esto depende del prompt: si el prompt falla, esto sigue en pie.

import type { CoachOutput } from './schema.ts';
import { WORD_LIMITS } from './schema.ts';

/** Señales médicas: fuerzan derivación a profesional pase lo que pase. */
const RED_FLAGS =
  /\b(dolor|duele|molestia|lesi[óo]n|lesionad|pinchazo|punzante|inflamad|hinchad|mareo|desmay|hormigueo|entumec|chasquido|crujido|tendinitis|hernia|esguince|rotura|desgarro|fractura)\w*/i;

/** Nutrición, suplementación y farmacología: fuera de alcance. */
const OUT_OF_SCOPE =
  /\b(\d+\s*(g|gr|gramos|mg|kcal|calor[íi]as?)|creatina|prote[íi]na\s+en\s+polvo|whey|bcaa|suplement\w*|esteroide\w*|anabolizante\w*|test[oó]stero\w*|d[ei]anabol|f[áa]rmac\w*)\b/i;

/** Recorta a `max` palabras sin cortar a mitad de palabra. */
function truncateWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text.trim();
  return `${words.slice(0, max).join(' ')}…`;
}

export interface SafetyContext {
  /** Texto que escribió el usuario en esta petición. */
  userText?: string;
  /** Último peso registrado por ejercicio, para el tope del 10%. */
  lastWeightByExercise: Record<string, number>;
}

export interface SafetyResult {
  output: CoachOutput;
  /** Qué se corrigió. Va a los logs, nunca al usuario. */
  corrections: string[];
}

/**
 * Aplica las barreras y devuelve una salida siempre segura de mostrar.
 *
 * No rechaza la respuesta entera salvo que sea insalvable: corregir es mejor
 * que dejar al usuario sin nada. Lo que no se puede corregir, se suprime.
 */
export function applySafety(output: CoachOutput, ctx: SafetyContext): SafetyResult {
  const corrections: string[] = [];
  let suggestions = [...output.suggestions];
  let needsProfessional = output.needs_professional;

  // 1. Bandera roja en lo que escribió el usuario: manda sobre el modelo.
  //    Si dice que le duele el hombro, da igual lo que opine el modelo.
  if (ctx.userText && RED_FLAGS.test(ctx.userText)) {
    if (!needsProfessional) corrections.push('red_flag_forzada');
    needsProfessional = true;
  }

  // 2. Derivado a profesional ⇒ ninguna pauta de carga. Este es exactamente el
  //    fallo que se midió en el banco de pruebas.
  if (needsProfessional) {
    const before = suggestions.length;
    suggestions = suggestions.filter((s) => s.kind !== 'load');
    if (suggestions.length !== before) corrections.push('carga_suprimida_por_derivacion');
  }

  // 3. Tope del 10% sobre el último peso real. El motor determinista de la
  //    capa 0 ya tiene el dato: aquí solo se comprueba.
  suggestions = suggestions.filter((s) => {
    if (s.kind !== 'load' || !s.exercise_name) return true;
    const last = ctx.lastWeightByExercise[s.exercise_name];
    if (!last) return true;
    const proposed = extractProposedWeight(s.action);
    if (proposed === null) return true;
    if (proposed > last * 1.1) {
      corrections.push(`salto_excesivo:${s.exercise_name}`);
      return false;
    }
    return true;
  });

  // 4. Nutrición y farmacología fuera. No se corrige: se borra.
  //
  //    Se quita la FRASE entera, no el término. Borrar solo la coincidencia
  //    dejaba textos como «Sube a de proteína en polvo al día»: sigue siendo
  //    consejo de nutrición, y encima roto. Un insight o una sugerencia con
  //    esto dentro se descartan enteros; el summary, por frases.
  const dropOffendingSentences = (t: string) =>
    t
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => !OUT_OF_SCOPE.test(sentence))
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  let summary = output.summary;
  if (OUT_OF_SCOPE.test(summary)) {
    corrections.push('nutricion_en_summary');
    summary = dropOffendingSentences(summary);
  }
  const insights = output.insights.filter((i) => {
    const bad = OUT_OF_SCOPE.test(i.body) || OUT_OF_SCOPE.test(i.title);
    if (bad) corrections.push('nutricion_en_insight');
    return !bad;
  });
  suggestions = suggestions.filter((s) => {
    const bad = OUT_OF_SCOPE.test(s.action) || OUT_OF_SCOPE.test(s.rationale);
    if (bad) corrections.push('nutricion_en_sugerencia');
    return !bad;
  });

  // 5. Longitudes: truncar en vez de confiar en que el modelo obedeció.
  const finalSummary = truncateWords(summary, WORD_LIMITS.summary);
  if (finalSummary !== summary) corrections.push('summary_truncado');

  return {
    output: {
      summary: finalSummary || 'Sin novedades esta semana.',
      insights: insights.map((i) => ({
        ...i,
        body: truncateWords(i.body, WORD_LIMITS.insightBody),
      })),
      suggestions: suggestions.map((s) => ({
        ...s,
        rationale: truncateWords(s.rationale, WORD_LIMITS.suggestionRationale),
      })),
      needs_professional: needsProfessional,
      // La memoria pasa de largo por aquí: su saneado (longitud, duplicados,
      // fuera de alcance) vive en memory.ts, que es quien la escribe.
      remember: output.remember ?? [],
    },
    corrections,
  };
}

/**
 * Saca el peso propuesto del texto de la acción ("sube a 105 kg" → 105).
 * Devuelve `null` si no hay número: sin dato no se puede juzgar el salto, y
 * bloquear por si acaso dejaría al usuario sin consejos legítimos.
 */
function extractProposedWeight(action: string): number | null {
  const m = action.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (!m) return null;
  const value = Number(m[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export { RED_FLAGS, OUT_OF_SCOPE };
