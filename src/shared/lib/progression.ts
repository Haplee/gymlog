/**
 * Sugerencia de progresión por doble progresión.
 *
 * Modelo: se trabaja dentro de un rango de reps [repMin, repMax] a peso fijo.
 * Cuando la mejor serie alcanza el techo del rango, se sube el peso y se vuelve
 * al suelo del rango. Si no, se intenta sumar 1 repetición.
 */

import { calculateFatiguePenalty, MAX_FATIGUE_PENALTY } from './fatigueCalculator';
import { nextRepTarget } from './perSide';
import type { FatigueContext } from './progressionCycle';

export interface ProgressionInput {
  reps: number;
  weight: number;
}

export type ProgressionAction = 'increase-weight' | 'add-reps';

export interface ProgressionSuggestion {
  /** Peso sugerido en kg. */
  weight: number;
  /** Repeticiones objetivo. */
  reps: number;
  action: ProgressionAction;
  /** Penalización por fatiga aplicada, entre 0 y 0,10. */
  fatigueApplied: number;
}

export interface ProgressionOptions {
  repMin?: number;
  repMax?: number;
  /** Incremento de peso en kg al subir carga. */
  incrementKg?: number;
  /**
   * El objetivo es por lado, así que las repeticiones suben de dos en dos.
   * Ver `shared/lib/perSide.ts`.
   */
  perSide?: boolean;
  /**
   * Fatiga acumulada en la sesión. Si viene, la carga sugerida baja: un
   * músculo que ya ha hecho series en la misma sesión llega fatigado al
   * ejercicio y subir ahí cuesta más de lo que cuesta en fresco.
   */
  fatigueContext?: FatigueContext;
  /** Penalización ya calculada para el contexto de fatiga. */
  fatiguePenalty?: number;
}

function clampFatiguePenalty(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_FATIGUE_PENALTY, Math.max(0, value));
}

function fatiguePenaltyOf(opts: ProgressionOptions): number {
  const explicit = opts.fatiguePenalty ?? opts.fatigueContext?.fatiguePenalty;
  if (explicit !== undefined) return clampFatiguePenalty(explicit);

  const ctx = opts.fatigueContext;
  if (!ctx) return 0;
  return clampFatiguePenalty(calculateFatiguePenalty(ctx.priorSets, ctx.sessionCount));
}

/**
 * Baja la carga sugerida por la fatiga acumulada en la sesión.
 *
 * La penalización es un porcentaje del peso, redondeado a medio kilo (el paso
 * con el que se montan los discos). Devuelve la sugerencia intacta cuando no
 * hay contexto de fatiga o cuando la penalización resulta cero.
 */
export function adjustForFatigue(
  suggestion: { weight: number; reps: number },
  ctx?: FatigueContext,
  fatiguePenalty?: number,
): { weight: number; reps: number } {
  if (!ctx && fatiguePenalty === undefined) return suggestion;
  const penalty = clampFatiguePenalty(
    fatiguePenalty ??
      ctx?.fatiguePenalty ??
      calculateFatiguePenalty(ctx?.priorSets ?? 0, ctx?.sessionCount),
  );
  if (penalty <= 0) return suggestion;
  return { ...suggestion, weight: Math.round(suggestion.weight * (1 - penalty) * 2) / 2 };
}

export function suggestProgression(
  lastSets: ProgressionInput[],
  opts: ProgressionOptions = {},
): ProgressionSuggestion | null {
  const repMin = opts.repMin ?? 8;
  const repMax = opts.repMax ?? 12;
  const inc = opts.incrementKg ?? 2.5;

  const working = lastSets.filter(
    (s) => Number.isFinite(s.weight) && Number.isFinite(s.reps) && s.weight > 0 && s.reps > 0,
  );
  if (working.length === 0) return null;

  // Mejor serie: mayor peso; a igualdad, más reps.
  const top = working.reduce((best, s) =>
    s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best,
  );

  if (top.reps >= repMax) {
    const suggestion: ProgressionSuggestion = {
      weight: Math.round((top.weight + inc) * 100) / 100,
      reps: repMin,
      action: 'increase-weight',
      fatigueApplied: 0,
    };
    return applyFatigue(suggestion, opts);
  }

  const suggestion: ProgressionSuggestion = {
    weight: top.weight,
    reps: nextRepTarget(top.reps, opts),
    action: 'add-reps',
    fatigueApplied: 0,
  };
  return applyFatigue(suggestion, opts);
}

/** La fatiga baja el peso de la sugerencia sin tocar la acción que la explica. */
function applyFatigue(
  suggestion: ProgressionSuggestion,
  opts: ProgressionOptions,
): ProgressionSuggestion {
  const fatiguePenalty = fatiguePenaltyOf(opts);
  if (fatiguePenalty <= 0) return suggestion;
  return {
    ...suggestion,
    ...adjustForFatigue(suggestion, opts.fatigueContext, fatiguePenalty),
    fatigueApplied: fatiguePenalty,
  };
}
