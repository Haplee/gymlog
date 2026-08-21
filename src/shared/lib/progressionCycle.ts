/**
 * Ciclo de progresión por ejercicio: doble progresión + descargas programadas.
 *
 * Es la memoria de la progresión entre sesiones. Complementa a `progression.ts`
 * (decisión puntual de carga) y a `autoregulation.ts` (autorregulación por
 * esfuerzo): aquí se lleva la cuenta de cuántas sesiones se llevan entrenando al
 * mismo esquema, cuándo toca una semana de descarga y qué peso hay que precargar
 * al empezar una rutina (auto-relleno).
 *
 * Todo es lógica pura y local: nada de esto sale del dispositivo por sí solo.
 * La persistencia (local y en Supabase) la gestiona el store de progresión.
 */

import { suggestProgression } from './progression';

/** Sesiones de carga entre descargas. Con el valor por defecto: 3 de carga y
 * la 4ª de descarga, el ciclo mensual típico. */
export const DEFAULT_DELOAD_CYCLE_LENGTH = 3;
/** Fracción de la carga durante la semana de descarga (0.7 = −30 %). */
export const DEFAULT_DELOAD_FRACTION = 0.7;
/** Escalón de carga por defecto (par de discos de 1,25 kg). */
export const DEFAULT_PROGRESSION_INCREMENT_KG = 2.5;

export interface DeloadConfig {
  /** Sesiones de carga que deben pasar antes de la siguiente descarga. */
  cycleLength?: number;
  /** Fracción de la carga durante la semana de descarga. */
  deloadFraction?: number;
}

export interface ProgressionConfig extends DeloadConfig {
  /** Suelo del rango de reps objetivo, p. ej. 8 de «8-12». */
  repMin?: number;
  /** Techo del rango de reps objetivo, p. ej. 12 de «8-12». */
  repMax?: number;
  /** Incremento de peso al subir carga, en kg. */
  incrementKg?: number;
  /** En peso corporal no se sube carga: solo repeticiones. */
  bodyweight?: boolean;
}

export interface ProgressionState {
  /** Nombre canónico del ejercicio tal y como se guarda en la BD. */
  exerciseName: string;
  repMin?: number;
  repMax?: number;
  incrementKg: number;
  bodyweight: boolean;
  /** Carga de trabajo actual (peso objetivo para la siguiente sesión). */
  currentWeight?: number;
  /** Reps objetivo para la siguiente sesión. */
  currentReps?: number;
  /** Sesiones de carga registradas desde la última descarga. */
  sessionCount: number;
  /**
   * Sesiones de carga que quedan antes de la siguiente descarga.
   * Al llegar a 0, la siguiente sesión pasa a ser de descarga.
   */
  nextDeloadWeek: number;
  /** La próxima sesión (o la que se acaba de registrar) es de descarga. */
  isDeloadWeek: boolean;
  updatedAt: string;
}

/** Mejor serie de una sesión registrada, con la que se decide la progresión. */
export interface ProgressionSessionOutcome {
  /** Peso de la mejor serie, en kg. */
  weight: number;
  /** Reps de la mejor serie. */
  reps: number;
  /**
   * Repeticiones de **todas** las series de trabajo de la sesión.
   *
   * Sin esto el ciclo subía el peso en cuanto la mejor serie tocaba el techo
   * del rango, y la mejor serie casi siempre es la primera, la que se hace
   * fresco: 100 × 10, 100 × 8, 100 × 7 contaba como sesión completada. Es
   * opcional para no romper a quien registre una sola serie, pero cuando llega
   * manda: la doble progresión exige el esquema entero antes de tocar la carga.
   */
  sessionReps?: number[];
}

export type ProgressionEventName = 'seed' | 'increase' | 'add-reps' | 'deload-start' | 'deload-end';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Normaliza el nombre de un ejercicio para usarlo como clave estable. */
export function normalizeExerciseName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Rango de reps del objetivo de la plantilla: '8-10' → [8, 10], '5' → [5, 5]. */
export function parseRepRange(targetReps?: string): { repMin?: number; repMax?: number } {
  const nums = targetReps?.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return {};
  const repMin = nums[0];
  const repMax = nums.length > 1 ? nums[nums.length - 1] : repMin;
  return { repMin, repMax };
}

function roundToStep(weight: number, step: number): number {
  return Math.round(Math.round(weight / step) * step * 100) / 100;
}

/**
 * ¿Se completaron todas las series de trabajo en el techo del rango?
 *
 * Sin techo declarado o sin el detalle de las series no hay nada que exigir y
 * se da por buena: es preferible comportarse como antes a frenar por una
 * ausencia de datos.
 */
function sessionCompleted(state: ProgressionState, outcome: ProgressionSessionOutcome): boolean {
  const repMax = state.repMax;
  if (repMax === undefined) return true;
  const reps = outcome.sessionReps;
  if (!reps || reps.length === 0) return true;
  return reps.every((r) => r >= repMax);
}

/** Fracción de descarga con seguridad ante configuraciones inválidas. */
function deloadFractionOf(config?: DeloadConfig): number {
  const f = config?.deloadFraction ?? DEFAULT_DELOAD_FRACTION;
  return Number.isFinite(f) && f > 0 && f <= 1 ? f : DEFAULT_DELOAD_FRACTION;
}

/** Sesiones de carga entre descargas (mínimo 1). */
function cycleLengthOf(config?: DeloadConfig): number {
  const n = config?.cycleLength ?? DEFAULT_DELOAD_CYCLE_LENGTH;
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : DEFAULT_DELOAD_CYCLE_LENGTH;
}

/* ------------------------------------------------------------------ */
/* Ciclo                                                               */
/* ------------------------------------------------------------------ */

/**
 * Estado inicial de un ejercicio que se registra por primera vez. La primera
 * sesión fija la carga de trabajo y cuenta como la primera del ciclo.
 */
export function createInitialProgression(
  name: string,
  outcome: ProgressionSessionOutcome,
  config: ProgressionConfig = {},
): ProgressionState {
  const cycleLength = cycleLengthOf(config);
  return {
    exerciseName: name,
    repMin: config.repMin,
    repMax: config.repMax,
    incrementKg: config.incrementKg ?? DEFAULT_PROGRESSION_INCREMENT_KG,
    bodyweight: config.bodyweight ?? false,
    currentWeight: outcome.weight,
    currentReps: outcome.reps,
    sessionCount: 1,
    nextDeloadWeek: cycleLength - 1,
    isDeloadWeek: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Avanza el ciclo tras una sesión registrada.
 *
 * - Si la sesión era de descarga, se cierra: se reanuda el ciclo de carga con la
 *   misma carga de trabajo y se pone el contador a cero.
 * - Si era de carga y el esquema se completó (todas las series de trabajo en el
 *   techo del rango, cuando se conocen), se aplica doble progresión sobre la
 *   mejor serie y se descuenta el contador hacia la próxima descarga. Al
 *   agotarse, la siguiente sesión queda marcada como de descarga.
 * - Si el esquema se quedó corto, la carga se consolida: la sesión cuenta, pero
 *   el peso no se mueve.
 * - En peso corporal nunca se sube carga: se progresa sumando repeticiones.
 */
export function advanceProgression(
  state: ProgressionState,
  outcome: ProgressionSessionOutcome,
  config: DeloadConfig = {},
): ProgressionState {
  const cycleLength = cycleLengthOf(config);
  const now = new Date().toISOString();

  if (state.isDeloadWeek) {
    return {
      ...state,
      isDeloadWeek: false,
      nextDeloadWeek: cycleLength - 1,
      sessionCount: 0,
      updatedAt: now,
    };
  }

  // El esquema no está completo: se consolida el peso sin tocar nada. Este es
  // el freno que faltaba en el auto-relleno de la rutina.
  if (!sessionCompleted(state, outcome)) {
    return {
      ...state,
      sessionCount: state.sessionCount + 1,
      updatedAt: now,
    };
  }

  let nextWeight: number;
  let nextReps: number;

  if (state.bodyweight) {
    nextWeight = state.currentWeight ?? outcome.weight;
    nextReps = (state.currentReps ?? outcome.reps) + 1;
  } else {
    const prog = suggestProgression([{ weight: outcome.weight, reps: outcome.reps }], {
      repMin: state.repMin,
      repMax: state.repMax,
      incrementKg: state.incrementKg,
    });
    nextWeight = prog ? prog.weight : outcome.weight;
    nextReps = prog ? prog.reps : outcome.reps;
  }

  const nextDeloadWeek = state.nextDeloadWeek - 1;
  const next: ProgressionState = {
    ...state,
    currentWeight: nextWeight,
    currentReps: nextReps,
    sessionCount: state.sessionCount + 1,
    nextDeloadWeek: Math.max(0, nextDeloadWeek),
    updatedAt: now,
  };

  if (nextDeloadWeek <= 0) {
    next.isDeloadWeek = true;
  }
  return next;
}

/**
 * Evento que describe la transición entre dos estados. `null` cuando no hay
 * cambio que registrar (misma carga y mismas reps, p. ej. una sesión en rango
 * que se consolida sin progresar).
 */
export function deriveProgressionEvent(
  prev: ProgressionState,
  next: ProgressionState,
): ProgressionEventName | null {
  if (!prev.isDeloadWeek && next.isDeloadWeek) return 'deload-start';
  if (prev.isDeloadWeek && !next.isDeloadWeek) return 'deload-end';
  if ((next.currentWeight ?? 0) > (prev.currentWeight ?? 0)) return 'increase';
  if ((next.currentReps ?? 0) > (prev.currentReps ?? 0)) return 'add-reps';
  return null;
}

/**
 * Peso a precargar en la próxima sesión (auto-relleno de la rutina).
 *
 * Usa la carga de trabajo del ciclo si existe; si no, la de la última sesión.
 * Durante una semana de descarga se reduce a la fracción configurada, redondeada
 * al escalón de carga para que sea realista con los discos disponibles.
 */
export function suggestedPrefillWeight(
  state: ProgressionState | null,
  lastTopWeight: number | null,
  config: DeloadConfig = {},
): number | null {
  if (state?.isDeloadWeek) {
    const base = state.currentWeight ?? lastTopWeight;
    if (base == null || base <= 0) return null;
    return roundToStep(base * deloadFractionOf(config), state.incrementKg);
  }
  return state?.currentWeight ?? lastTopWeight;
}
