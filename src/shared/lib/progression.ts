/**
 * Sugerencia de progresión por doble progresión.
 *
 * Modelo: se trabaja dentro de un rango de reps [repMin, repMax] a peso fijo.
 * Cuando la mejor serie alcanza el techo del rango, se sube el peso y se vuelve
 * al suelo del rango. Si no, se intenta sumar 1 repetición.
 */

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
}

export interface ProgressionOptions {
  repMin?: number;
  repMax?: number;
  /** Incremento de peso en kg al subir carga. */
  incrementKg?: number;
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
    return {
      weight: Math.round((top.weight + inc) * 100) / 100,
      reps: repMin,
      action: 'increase-weight',
    };
  }

  return { weight: top.weight, reps: top.reps + 1, action: 'add-reps' };
}
