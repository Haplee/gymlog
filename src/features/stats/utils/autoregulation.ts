/**
 * Autorregulación: sugerencia de carga para la próxima sesión a partir del
 * esfuerzo percibido ya registrado (RIR/RPE), detección de estancamiento y
 * recomendación de descarga.
 *
 * Todo es lógica pura y local: no sale ni un byte del dispositivo. Es la capa 0
 * del entrenador — funciona con el entrenador IA desactivado y es la que le da
 * al modelo conclusiones ya calculadas cuando sí está activado.
 *
 * Complementa a `@shared/lib/progression` (doble progresión por rango de reps):
 * aquí la decisión la manda el esfuerzo, no solo las repeticiones alcanzadas.
 */

import { calcular1RM } from '@shared/lib/brzycki';
import { suggestProgression } from '@shared/lib/progression';
import {
  DEFAULT_LOAD_STEP_KG,
  LOAD_RATIO_PER_RIR,
  MAX_INCREASE_RATIO,
  TARGET_INCREASE_RATIO,
  backOffLoad,
  nextAchievableLoad,
} from '@shared/lib/loadStep';
import { format, startOfWeek } from 'date-fns';

export { DEFAULT_LOAD_STEP_KG, MAX_INCREASE_RATIO };

/** RIR objetivo por defecto: dejar ~2 repeticiones en recámara. */
export const DEFAULT_TARGET_RIR = 2;

/** Sesiones sin mejora de e1RM a partir de las cuales se considera estancamiento. */
const STALL_SESSIONS = 3;
/** Días sin mejora de e1RM a partir de los cuales se considera estancamiento. */
const STALL_DAYS = 21;
/** Sesiones estancado a partir de las cuales se retrocede en vez de insistir. */
const STALL_RESET_SESSIONS = 5;
/** Cuánto se retrocede al reiniciar tras un estancamiento largo. */
const STALL_RESET_RATIO = 0.1;

/**
 * Días desde la última sesión a partir de los cuales el dato deja de servir
 * para subir carga.
 *
 * Tras dos semanas sin tocar un ejercicio, la carga de la última sesión ya no
 * describe lo que se puede levantar hoy. Subir sobre un dato caducado es la
 * forma más rápida de fallar una serie: se repite el peso y se vuelve a medir.
 */
const STALE_DAYS = 14;

/**
 * Subida acumulada máxima en una misma semana, en tanto por uno.
 *
 * Quien entrena un ejercicio dos veces por semana recibía dos subidas: dos
 * escalones seguidos son un +5 % en siete días sobre cargas altas y bastante
 * más sobre las ligeras. El tope se mide sobre el histórico real de esa ventana,
 * no sobre la sesión anterior.
 */
const WEEKLY_INCREASE_CAP = 0.06;

const DAY_MS = 86_400_000;

export interface AutoRegSet {
  weight: number;
  reps: number;
  /** Repeticiones en recámara, 0–5. */
  rir?: number | null;
  /** Esfuerzo percibido, 1–10. Se usa para derivar el RIR si este falta. */
  rpe?: number | null;
  is_warmup?: boolean | null;
}

export interface AutoRegSession {
  /** Fecha ISO de la sesión. Solo se usa para ordenar y medir huecos. */
  date: string;
  sets: AutoRegSet[];
}

export type LoadAction = 'increase' | 'hold' | 'reduce';

export interface LoadSuggestion {
  /** Peso sugerido en kg, ya redondeado al escalón. */
  weight: number;
  /** Peso de trabajo de la última sesión, para poder mostrar "de X a Y". */
  baseWeight: number;
  /**
   * Repeticiones de la serie tope de la última sesión.
   *
   * Va aparte de `reps` (las sugeridas) porque quien pinta "de X a Y" necesita
   * el pasado real: reutilizar `reps` para ambos lados hacía que la tarjeta
   * mostrara «última · 80 kg × 11» cuando la última sesión fue 80 kg × 10.
   */
  baseReps: number;
  /** Repeticiones objetivo. */
  reps: number;
  action: LoadAction;
  /** Variación sobre el peso de trabajo anterior, en % con un decimal. */
  deltaPct: number;
  /** Clave i18n del motivo (namespace `coach.reason.*`). */
  reasonKey: string;
  /** Cuánta evidencia hay detrás: sesiones con esfuerzo registrado. */
  confidence: 'low' | 'medium' | 'high';
}

export interface AutoRegOptions {
  targetRir?: number;
  /** Escalón mínimo de carga en kg. */
  stepKg?: number;
  /** Suelo y techo del rango de reps objetivo, p. ej. [8, 12] de «8-12». */
  repMin?: number;
  repMax?: number;
  /** En peso corporal no se sugiere subir carga: solo repeticiones. */
  bodyweight?: boolean;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Serie de trabajo válida: no calentamiento y con carga y reps reales. */
function isWorkingSet(s: AutoRegSet): boolean {
  return (
    !s.is_warmup &&
    Number.isFinite(s.weight) &&
    Number.isFinite(s.reps) &&
    s.weight > 0 &&
    s.reps > 0
  );
}

/**
 * RIR efectivo de una serie. Si no hay RIR pero sí RPE se deriva con la
 * equivalencia habitual RIR ≈ 10 − RPE, acotada al rango 0–5 de la BD.
 */
export function effectiveRir(s: AutoRegSet): number | null {
  if (typeof s.rir === 'number' && Number.isFinite(s.rir)) return clamp(s.rir, 0, 5);
  if (typeof s.rpe === 'number' && Number.isFinite(s.rpe)) return clamp(10 - s.rpe, 0, 5);
  return null;
}

/** Media de RIR de las series de trabajo, o `null` si ninguna lo registra. */
function sessionRir(session: AutoRegSession): number | null {
  const values = session.sets
    .filter(isWorkingSet)
    .map(effectiveRir)
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** RPE máximo alcanzado en la sesión (derivado del RIR si hace falta). */
function sessionMaxRpe(session: AutoRegSession): number | null {
  const values = session.sets
    .filter(isWorkingSet)
    .map((s) => {
      if (typeof s.rpe === 'number' && Number.isFinite(s.rpe)) return clamp(s.rpe, 1, 10);
      const rir = effectiveRir(s);
      return rir === null ? null : 10 - rir;
    })
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.max(...values);
}

/** Serie más pesada de la sesión; a igualdad de peso, la de más repeticiones. */
function topSet(session: AutoRegSession): AutoRegSet | null {
  const working = session.sets.filter(isWorkingSet);
  if (working.length === 0) return null;
  return working.reduce((best, s) =>
    s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best,
  );
}

/** Mejor e1RM de la sesión. */
function sessionBest1RM(session: AutoRegSession): number {
  const working = session.sets.filter(isWorkingSet);
  if (working.length === 0) return 0;
  return Math.max(...working.map((s) => calcular1RM(s.weight, s.reps)));
}

/** Sesiones con al menos una serie de trabajo, ordenadas de antigua a reciente. */
function usableSessions(sessions: AutoRegSession[]): AutoRegSession[] {
  return sessions
    .filter((s) => s.sets.some(isWorkingSet))
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** Días transcurridos entre dos sesiones. */
function daysBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS;
}

/**
 * ¿Cumplió la sesión el esquema completo en el techo del rango?
 *
 * Esta es la corrección de fondo del motor. Antes bastaba con que la **serie
 * tope** llegara al techo para recomendar más peso, y la serie tope es casi
 * siempre la primera, la que se hace fresco. Con 100 × 12, 100 × 9 y 100 × 7 la
 * sesión no está terminada —dos de las tres series se quedaron cortas— y aun
 * así el motor mandaba subir. De ahí la sensación de que la app sube el peso
 * todas las semanas pase lo que pase.
 *
 * La doble progresión de manual exige completar **todas** las series de trabajo
 * en el techo antes de tocar la carga. Con una sola serie registrada el
 * resultado es el mismo que antes, así que no penaliza a quien registra poco.
 */
function allWorkingSetsAtCeiling(session: AutoRegSession, repMax: number): boolean {
  const working = session.sets.filter(isWorkingSet);
  if (working.length === 0) return false;
  return working.every((s) => s.reps >= repMax);
}

/**
 * Subida de carga ya acumulada en los últimos 7 días, en tanto por uno.
 *
 * Se compara la carga de trabajo de la última sesión con la más baja registrada
 * dentro de la ventana. Devuelve 0 si no hay otra sesión en esos 7 días, que es
 * el caso normal de quien entrena cada ejercicio una vez por semana: a ese no le
 * frena nada.
 */
function weeklyIncreaseSoFar(usable: AutoRegSession[]): number {
  const last = usable[usable.length - 1];
  const lastTop = topSet(last);
  if (!lastTop) return 0;

  let lowest = lastTop.weight;
  for (let i = usable.length - 2; i >= 0; i--) {
    if (daysBetween(usable[i].date, last.date) > 7) break;
    const top = topSet(usable[i]);
    if (top && top.weight < lowest) lowest = top.weight;
  }
  if (lowest <= 0) return 0;
  return lastTop.weight / lowest - 1;
}

/* ------------------------------------------------------------------ */
/* Sugerencia de carga                                                 */
/* ------------------------------------------------------------------ */

/**
 * Peso y reps sugeridos para la próxima sesión de un ejercicio.
 *
 * Devuelve `null` —y no inventa nada— si hay menos de dos sesiones utilizables
 * o si la última no registra ningún esfuerzo (ni RIR ni RPE).
 *
 * Reglas, en orden de prioridad:
 *  1. Se llegó al fallo o casi (RPE ≥ 9,5) y las reps bajan ⇒ reducir.
 *  2. Sobra margen (RIR ≥ objetivo + 2) ⇒ subir carga, con tope duro del 10%.
 *  3. Se apura por encima del objetivo dos sesiones seguidas ⇒ mantener.
 *  4. En rango ⇒ mantener carga e intentar sumar una repetición.
 */
export function suggestNextLoad(
  sessions: AutoRegSession[],
  opts: AutoRegOptions = {},
): LoadSuggestion | null {
  const targetRir = opts.targetRir ?? DEFAULT_TARGET_RIR;
  const step = opts.stepKg ?? DEFAULT_LOAD_STEP_KG;
  const repMin = opts.repMin;
  const repMax = opts.repMax;

  const usable = usableSessions(sessions);
  if (usable.length < 2) return null;

  const last = usable[usable.length - 1];
  const prev = usable[usable.length - 2];

  const lastTop = topSet(last);
  if (!lastTop) return null;

  const lastRir = sessionRir(last);
  if (lastRir === null) return null;

  const prevRir = sessionRir(prev);
  const prevTop = topSet(prev);

  const withEffort = usable.filter((s) => sessionRir(s) !== null).length;
  const confidence: LoadSuggestion['confidence'] =
    withEffort >= 4 ? 'high' : withEffort >= 2 ? 'medium' : 'low';

  const baseWeight = lastTop.weight;
  const baseReps = lastTop.reps;

  const mk = (
    weight: number,
    reps: number,
    action: LoadAction,
    reasonKey: string,
  ): LoadSuggestion => ({
    weight,
    baseWeight,
    baseReps,
    reps,
    action,
    deltaPct: Math.round(((weight - baseWeight) / baseWeight) * 1000) / 10,
    reasonKey,
    confidence,
  });

  // 1. Al límite y perdiendo repeticiones ⇒ bajar carga. El recorte se deriva
  //    del desfase de esfuerzo (≈4 % por punto de RPE), con un suelo de un 5 %:
  //    recortar menos que eso no cambia nada en la barra.
  const maxRpe = sessionMaxRpe(last);
  const repsDropped = prevTop ? lastTop.reps < prevTop.reps : false;
  if (maxRpe !== null && maxRpe >= 9.5 && repsDropped) {
    const overshoot = Math.max(1, maxRpe - (10 - targetRir));
    const ratio = Math.min(0.1, Math.max(0.05, overshoot * 0.04));
    return mk(backOffLoad(baseWeight, ratio, step), baseReps, 'reduce', 'coach.reason.at_failure');
  }

  // Puertas previas a cualquier subida. Ninguna baja la carga: solo impiden
  // subirla cuando el dato no da para tanto.
  const staleDays = daysBetween(prev.date, last.date);
  const dataIsStale = staleDays > STALE_DAYS;
  const weeklyJump = weeklyIncreaseSoFar(usable);
  const alreadyRaisedThisWeek = weeklyJump >= WEEKLY_INCREASE_CAP;

  /** Subida efectiva, o `null` si por carga no toca (o no cabe). */
  const raise = (ratio: number) =>
    opts.bodyweight ? null : nextAchievableLoad(baseWeight, { ratio, stepKg: step });

  // 2. Sobra margen ⇒ subir. Cuánto lo dice la propia desviación de esfuerzo:
  //    la literatura de autorregulación mueve la carga en torno a un 4 % por
  //    punto de RPE, así que se usa ~3 % por RIR sobrante, con el tope del 10 %.
  if (lastRir >= targetRir + 2) {
    if (dataIsStale) return mk(baseWeight, baseReps, 'hold', 'coach.reason.stale_data');
    if (alreadyRaisedThisWeek) {
      return mk(baseWeight, baseReps, 'hold', 'coach.reason.weekly_cap');
    }
    const target = raise((lastRir - targetRir) * LOAD_RATIO_PER_RIR);

    // Sin salto montable bajo el tope (cargas muy ligeras, o peso corporal),
    // progresa por repeticiones. Es doble progresión, no un parche.
    if (target === null) return mk(baseWeight, baseReps + 1, 'hold', 'coach.reason.add_rep');

    // Subir carga en el techo del rango se premia restando reps: se vuelve al
    // suelo y se trabaja el mismo esquema de progresión (doble progresión).
    const reps = repMax !== undefined && baseReps >= repMax ? (repMin ?? baseReps) : baseReps;
    return mk(target, reps, 'increase', 'coach.reason.margin_left');
  }

  // 3. Se apura por debajo del objetivo dos sesiones seguidas ⇒ consolidar.
  if (lastRir <= targetRir - 1 && prevRir !== null && prevRir <= targetRir - 1) {
    return mk(baseWeight, baseReps, 'hold', 'coach.reason.too_hard');
  }

  // 4. En rango: misma carga, una repetición más. Solo cuando **todas** las
  //    series de trabajo llegaron al techo del rango se sube un escalón y se
  //    vuelve al suelo (doble progresión de verdad). En peso corporal no se
  //    puede subir carga, así que se suma una repetición aunque se pase.
  if (repMax !== undefined && baseReps >= repMax) {
    if (!allWorkingSetsAtCeiling(last, repMax)) {
      return mk(baseWeight, baseReps, 'hold', 'coach.reason.finish_the_sets');
    }
    if (dataIsStale) return mk(baseWeight, baseReps, 'hold', 'coach.reason.stale_data');
    if (alreadyRaisedThisWeek) {
      return mk(baseWeight, baseReps, 'hold', 'coach.reason.weekly_cap');
    }
    const target = raise(TARGET_INCREASE_RATIO);
    if (target === null) return mk(baseWeight, baseReps + 1, 'hold', 'coach.reason.on_target');
    return mk(target, repMin ?? baseReps, 'increase', 'coach.reason.ceiling');
  }
  return mk(baseWeight, baseReps + 1, 'hold', 'coach.reason.on_target');
}

/**
 * Fallback de doble progresión cuando la última sesión no registra esfuerzo.
 *
 * `suggestNextLoad` se niega a decidir sin RIR/RPE: es su contrato. Pero la
 * mayoría de usuarios registra solo peso y reps, y con historial basta para
 * una sugerencia segura: se repite el peso de la mejor serie y se intenta
 * sumar una repetición; si ya se alcanzó el techo del rango, se sube un
 * escalón. En peso corporal nunca se sube carga: se progresa por repeticiones.
 */
export function suggestFromLastSession(
  sessions: AutoRegSession[],
  opts: { repMin?: number; repMax?: number; bodyweight?: boolean; stepKg?: number } = {},
): LoadSuggestion | null {
  const usable = usableSessions(sessions);
  if (usable.length === 0) return null;

  const last = usable[usable.length - 1];
  const working = last.sets.filter(isWorkingSet);
  if (working.length === 0) return null;

  const top = topSet(last);
  if (!top) return null;

  const step = opts.stepKg ?? DEFAULT_LOAD_STEP_KG;
  const prog = suggestProgression(
    working.map((s) => ({ weight: s.weight, reps: s.reps })),
    { repMin: opts.repMin, repMax: opts.repMax, incrementKg: step },
  );
  if (!prog) return null;

  const mk = (
    weight: number,
    reps: number,
    action: LoadAction,
    reasonKey: string,
  ): LoadSuggestion => ({
    weight,
    baseWeight: top.weight,
    baseReps: top.reps,
    reps,
    action,
    deltaPct: top.weight > 0 ? Math.round(((weight - top.weight) / top.weight) * 1000) / 10 : 0,
    reasonKey,
    confidence: 'low',
  });

  // Sin esfuerzo registrado este es el único camino, así que es el que decide de
  // verdad para la mayoría de usuarios. Por eso lleva las mismas puertas que el
  // motor con RIR: aquí es donde se producía la subida automática cada semana.
  if (prog.action !== 'increase-weight' || opts.bodyweight) {
    // En peso corporal, alcanzar el techo no se premia reseteando las reps a la
    // baja: se sigue sumando una repetición, la única progresión segura.
    const reps = prog.action === 'increase-weight' ? top.reps + 1 : prog.reps;
    return mk(top.weight, reps, 'hold', 'coach.reason.no_effort_reps');
  }

  const repMax = opts.repMax;
  if (repMax !== undefined && !allWorkingSetsAtCeiling(last, repMax)) {
    return mk(top.weight, top.reps, 'hold', 'coach.reason.finish_the_sets');
  }
  if (usable.length >= 2 && daysBetween(usable[usable.length - 2].date, last.date) > STALE_DAYS) {
    return mk(top.weight, top.reps, 'hold', 'coach.reason.stale_data');
  }
  if (weeklyIncreaseSoFar(usable) >= WEEKLY_INCREASE_CAP) {
    return mk(top.weight, top.reps, 'hold', 'coach.reason.weekly_cap');
  }

  const target = nextAchievableLoad(top.weight, { ratio: TARGET_INCREASE_RATIO, stepKg: step });
  if (target === null) return mk(top.weight, top.reps + 1, 'hold', 'coach.reason.add_rep');

  return mk(target, prog.reps, 'increase', 'coach.reason.no_effort_increase');
}

/**
 * Modulación por recuperación: si el wearable dice que se ha dormido poco o que
 * la FC de reposo está alta, una subida de carga pasa a mantenimiento.
 *
 * Recibe una forma estructural (no importa el tipo de wearables) para no acoplar
 * stats con esa feature. Sin dato de recuperación devuelve la sugerencia intacta.
 */
export function applyReadiness(
  suggestion: LoadSuggestion | null,
  readiness: { holdLoad: boolean; reasonKey: string } | null,
): LoadSuggestion | null {
  if (!suggestion || !readiness?.holdLoad) return suggestion;
  if (suggestion.action !== 'increase') return suggestion;

  return {
    ...suggestion,
    action: 'hold',
    weight: suggestion.baseWeight,
    deltaPct: 0,
    reasonKey: readiness.reasonKey,
  };
}

/**
 * Retroceso programado ante un estancamiento.
 *
 * El estancamiento ya se detectaba, pero solo se pintaba en la tarjeta: la
 * sugerencia de carga seguía a lo suyo y podía mandar subir peso a alguien que
 * llevaba cinco sesiones sin mejorar. Insistir en subir sobre un tope que no se
 * mueve es la definición de estancarse más.
 *
 * - Estancado ⇒ nunca se sube: primero hay que romper el techo con el peso que
 *   ya se tiene.
 * - Estancado de largo (≥5 sesiones o ≥3 semanas) ⇒ se retrocede un 10 % para
 *   volver a coger carrerilla. Es la descarga clásica de reinicio, no un
 *   castigo.
 *
 * Una bajada ya decidida por esfuerzo se respeta: es una señal más específica.
 */
export function applyStall(
  suggestion: LoadSuggestion | null,
  stall: StallResult | null,
  opts: { stepKg?: number } = {},
): LoadSuggestion | null {
  if (!suggestion || !stall?.stalled) return suggestion;
  if (suggestion.action === 'reduce') return suggestion;

  const step = opts.stepKg ?? DEFAULT_LOAD_STEP_KG;
  const deep = stall.sessionsSinceBest >= STALL_RESET_SESSIONS || stall.daysSinceBest >= STALL_DAYS;

  if (deep) {
    const weight = backOffLoad(suggestion.baseWeight, STALL_RESET_RATIO, step);
    if (weight < suggestion.baseWeight) {
      return {
        ...suggestion,
        action: 'reduce',
        weight,
        reps: suggestion.baseReps,
        deltaPct:
          Math.round(((weight - suggestion.baseWeight) / suggestion.baseWeight) * 1000) / 10,
        reasonKey: 'coach.reason.stall_reset',
      };
    }
  }

  if (suggestion.action !== 'increase') return suggestion;
  return {
    ...suggestion,
    action: 'hold',
    weight: suggestion.baseWeight,
    reps: suggestion.baseReps,
    deltaPct: 0,
    reasonKey: 'coach.reason.stall_hold',
  };
}

/* ------------------------------------------------------------------ */
/* Estancamiento                                                       */
/* ------------------------------------------------------------------ */

export type StallCause = 'fatigue' | 'frequency' | 'volume' | 'unknown';

export interface StallResult {
  stalled: boolean;
  /** Sesiones transcurridas desde el último mejor e1RM. */
  sessionsSinceBest: number;
  /** Días transcurridos desde el último mejor e1RM. */
  daysSinceBest: number;
  causeKey: StallCause;
}

/**
 * Estancamiento: sin mejora de e1RM en ≥3 sesiones o ≥21 días.
 * Devuelve `null` con menos de tres sesiones utilizables (no hay tendencia).
 */
export function detectStall(sessions: AutoRegSession[]): StallResult | null {
  const usable = usableSessions(sessions);
  if (usable.length < 3) return null;

  let best = -Infinity;
  let bestIdx = 0;
  usable.forEach((s, i) => {
    const value = sessionBest1RM(s);
    if (value > best) {
      best = value;
      bestIdx = i;
    }
  });

  const lastIdx = usable.length - 1;
  const sessionsSinceBest = lastIdx - bestIdx;
  const daysSinceBest = Math.floor(
    (new Date(usable[lastIdx].date).getTime() - new Date(usable[bestIdx].date).getTime()) /
      86_400_000,
  );

  const stalled = sessionsSinceBest >= STALL_SESSIONS || daysSinceBest >= STALL_DAYS;
  if (!stalled) {
    return { stalled: false, sessionsSinceBest, daysSinceBest, causeKey: 'unknown' };
  }

  return {
    stalled: true,
    sessionsSinceBest,
    daysSinceBest,
    causeKey: probableCause(usable),
  };
}

/**
 * Causa probable del estancamiento. El orden importa: si se está apurando al
 * máximo, el problema es la recuperación antes que el volumen.
 */
function probableCause(usable: AutoRegSession[]): StallCause {
  const recent = usable.slice(-4);

  const rirs = recent.map(sessionRir).filter((v): v is number => v !== null);
  const avgRir = rirs.length > 0 ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
  if (avgRir !== null && avgRir <= 1) return 'fatigue';

  if (recent.length >= 2) {
    let totalGap = 0;
    for (let i = 1; i < recent.length; i++) {
      totalGap +=
        (new Date(recent[i].date).getTime() - new Date(recent[i - 1].date).getTime()) / 86_400_000;
    }
    if (totalGap / (recent.length - 1) > 10) return 'frequency';
  }

  const avgSets =
    recent.reduce((sum, s) => sum + s.sets.filter(isWorkingSet).length, 0) / recent.length;
  if (avgSets < 3) return 'volume';

  return 'unknown';
}

/* ------------------------------------------------------------------ */
/* Descarga (deload)                                                   */
/* ------------------------------------------------------------------ */

export interface DeloadInput {
  /** Volumen semanal, de la semana más antigua a la más reciente. */
  weeklyVolumes: number[];
  /**
   * RIR medio por semana, mismo orden que `weeklyVolumes`.
   * `null` = esa semana ninguna serie registró esfuerzo (RIR/RPE).
   */
  weeklyRir: (number | null)[];
  /** Valoraciones de sesión recientes (1–5). Opcional. */
  sessionRatings?: number[];
}

export interface DeloadSuggestion {
  recommended: boolean;
  reasonKey: string;
  /** Semanas consecutivas de subida de volumen detectadas. */
  risingWeeks: number;
}

/**
 * Recomienda una semana de descarga cuando el volumen lleva ≥3 semanas subiendo,
 * el RIR cae (cada vez cuesta más el mismo trabajo) y —si hay valoraciones— las
 * sesiones se están puntuando bajo. Todas las señales disponibles deben coincidir:
 * una sola no basta para mandar a alguien a descargar.
 */
export function suggestDeload(input: DeloadInput): DeloadSuggestion | null {
  const { weeklyVolumes, weeklyRir, sessionRatings } = input;
  if (weeklyVolumes.length < 3 || weeklyRir.length < 3) return null;

  const vols = weeklyVolumes.slice(-4);
  let risingWeeks = 0;
  for (let i = vols.length - 1; i > 0; i--) {
    if (vols[i] > vols[i - 1]) risingWeeks++;
    else break;
  }

  // La caída del RIR se juzga solo con las semanas que tienen esfuerzo
  // registrado: con menos de dos no se puede confirmar que cada vez cueste más.
  const rirValues = weeklyRir.slice(-3).filter((v): v is number => v !== null);
  const rirFalling = rirValues.length >= 2 && rirValues[rirValues.length - 1] < rirValues[0];

  const ratingsLow =
    sessionRatings && sessionRatings.length > 0
      ? sessionRatings.reduce((a, b) => a + b, 0) / sessionRatings.length <= 2.5
      : true; // sin valoraciones no se puede refutar, no se exige

  const recommended = risingWeeks >= 3 && rirFalling && ratingsLow;

  return {
    recommended,
    risingWeeks,
    reasonKey: recommended ? 'coach.reason.deload' : 'coach.reason.no_deload',
  };
}

/* ------------------------------------------------------------------ */
/* Productores semanales para el deload                                */
/* ------------------------------------------------------------------ */

/** Una semana de entrenamiento resumida para el análisis de descarga. */
export interface WeeklyDeloadSample {
  /** Fecha ISO (YYYY-MM-DD) del lunes que abre la semana. */
  weekStart: string;
  /** Volumen total de las series de trabajo (Σ peso × reps). */
  volume: number;
  /** RIR medio de la semana, o `null` si ninguna serie registró esfuerzo. */
  rir: number | null;
}

/** Entreno tal y como lo consume el productor de deload. */
export interface DeloadWorkout {
  started_at: string | null;
  /** Valoración de la sesión (1–5), opcional. */
  rating?: number | null;
  sets: AutoRegSet[];
}

/**
 * Agrupa entrenos en semanas ISO (lunes a domingo) y resume volumen y RIR de
 * cada una. Ordenado de la semana más antigua a la más reciente. Las semanas
 * sin series de trabajo no entran; una semana con esfuerzo parcial reporta el
 * RIR medio solo de las series que sí lo registran.
 */
export function buildWeeklyDeloadSamples(workouts: DeloadWorkout[]): WeeklyDeloadSample[] {
  const weeks = new Map<string, { volume: number; rirs: number[] }>();
  for (const w of workouts) {
    if (!w.started_at) continue;
    const date = new Date(w.started_at);
    if (Number.isNaN(date.getTime())) continue;
    const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    let bucket = weeks.get(weekStart);
    if (!bucket) {
      bucket = { volume: 0, rirs: [] };
      weeks.set(weekStart, bucket);
    }
    for (const s of w.sets) {
      if (!isWorkingSet(s)) continue;
      bucket.volume += s.weight * s.reps;
      const rir = effectiveRir(s);
      if (rir !== null) bucket.rirs.push(rir);
    }
  }
  return [...weeks.entries()]
    .filter(([, b]) => b.volume > 0)
    .map(([weekStart, bucket]) => ({
      weekStart,
      volume: bucket.volume,
      rir:
        bucket.rirs.length > 0 ? bucket.rirs.reduce((a, b) => a + b, 0) / bucket.rirs.length : null,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Últimas valoraciones de sesión registradas (1–5), de la más reciente a la
 * más antigua.
 */
export function collectRecentSessionRatings(workouts: DeloadWorkout[], limit = 5): number[] {
  return workouts
    .filter((w): w is DeloadWorkout & { rating: number } => typeof w.rating === 'number')
    .sort((a, b) => String(b.started_at ?? '').localeCompare(String(a.started_at ?? '')))
    .slice(0, limit)
    .map((w) => w.rating);
}

/**
 * Productor de `DeloadInput` desde los entrenos cargados: volumen y RIR por
 * semana más las valoraciones recientes. Devuelve `null` si no hay datos.
 */
export function buildDeloadInput(workouts: DeloadWorkout[]): DeloadInput | null {
  const samples = buildWeeklyDeloadSamples(workouts);
  if (samples.length === 0) return null;
  return {
    weeklyVolumes: samples.map((s) => s.volume),
    weeklyRir: samples.map((s) => s.rir),
    sessionRatings: collectRecentSessionRatings(workouts),
  };
}
