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
import { format, startOfWeek } from 'date-fns';

/** RIR objetivo por defecto: dejar ~2 repeticiones en recámara. */
export const DEFAULT_TARGET_RIR = 2;
/** Salto máximo de carga permitido en una sesión, en tanto por uno. */
export const MAX_INCREASE_RATIO = 0.1;
/** Escalón de carga por defecto (par de discos de 1,25 kg). */
export const DEFAULT_LOAD_STEP_KG = 2.5;

/** Sesiones sin mejora de e1RM a partir de las cuales se considera estancamiento. */
const STALL_SESSIONS = 3;
/** Días sin mejora de e1RM a partir de los cuales se considera estancamiento. */
const STALL_DAYS = 21;

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

function roundToStep(weight: number, step: number): number {
  return Math.round(Math.round(weight / step) * step * 100) / 100;
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
    reps,
    action,
    deltaPct: Math.round(((weight - baseWeight) / baseWeight) * 1000) / 10,
    reasonKey,
    confidence,
  });

  // 1. Al límite y perdiendo repeticiones ⇒ bajar carga.
  const maxRpe = sessionMaxRpe(last);
  const repsDropped = prevTop ? lastTop.reps < prevTop.reps : false;
  if (maxRpe !== null && maxRpe >= 9.5 && repsDropped) {
    const reduced = Math.max(step, roundToStep(baseWeight * 0.95, step));
    return mk(reduced, baseReps, 'reduce', 'coach.reason.at_failure');
  }

  // 2. Sobra margen ⇒ subir, respetando el tope del 10%.
  if (lastRir >= targetRir + 2) {
    const ratio = lastRir >= targetRir + 3 ? 0.05 : 0.025;
    const cap = baseWeight * (1 + MAX_INCREASE_RATIO);
    let target = roundToStep(baseWeight * (1 + ratio), step);
    // El redondeo puede comerse el incremento: forzar al menos un escalón.
    if (target <= baseWeight) target = roundToStep(baseWeight + step, step);
    if (target > cap) target = roundToStep(baseWeight * (1 + MAX_INCREASE_RATIO), step);

    // Si ni un escalón cabe bajo el tope (cargas muy ligeras), progresa por
    // repeticiones en lugar de por carga. Es doble progresión, no un parche.
    if (target <= baseWeight || target > cap) {
      return mk(baseWeight, baseReps + 1, 'hold', 'coach.reason.add_rep');
    }
    // Subir carga en el techo del rango se premia restando reps: se vuelve al
    // suelo y se trabaja el mismo esquema de progresión (doble progresión).
    const reps = repMax !== undefined && baseReps >= repMax && !opts.bodyweight
      ? repMin ?? baseReps
      : baseReps;
    return mk(target, reps, 'increase', 'coach.reason.margin_left');
  }

  // 3. Se apura por debajo del objetivo dos sesiones seguidas ⇒ consolidar.
  if (lastRir <= targetRir - 1 && prevRir !== null && prevRir <= targetRir - 1) {
    return mk(baseWeight, baseReps, 'hold', 'coach.reason.too_hard');
  }

  // 4. En rango: misma carga, una repetición más. Si ya se está en el techo del
  //    rango de reps objetivo, la única progresión segura es subir un escalón y
  //    volver al suelo (doble progresión). En peso corporal no se puede subir
  //    carga, así que se suma una repetición aunque se pase del techo.
  if (repMax !== undefined && baseReps >= repMax) {
    if (opts.bodyweight) {
      return mk(baseWeight, baseReps + 1, 'hold', 'coach.reason.on_target');
    }
    const target = roundToStep(baseWeight + step, step);
    // El escalón no cabe bajo el tope del 10% (cargas muy ligeras): se
    // progresa por repeticiones igual que en el caso de margen.
    if (target > baseWeight * (1 + MAX_INCREASE_RATIO)) {
      return mk(baseWeight, baseReps + 1, 'hold', 'coach.reason.on_target');
    }
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
  opts: { repMin?: number; repMax?: number; bodyweight?: boolean } = {},
): LoadSuggestion | null {
  const usable = usableSessions(sessions);
  if (usable.length === 0) return null;

  const last = usable[usable.length - 1];
  const working = last.sets.filter(isWorkingSet);
  if (working.length === 0) return null;

  const top = topSet(last);
  if (!top) return null;

  const prog = suggestProgression(
    working.map((s) => ({ weight: s.weight, reps: s.reps })),
    { repMin: opts.repMin, repMax: opts.repMax },
  );
  if (!prog) return null;

  const increase = prog.action === 'increase-weight' && !opts.bodyweight;
  const weight = increase ? prog.weight : top.weight;
  // En peso corporal, alcanzar el techo no se premia reseteando las reps a la
  // baja: se sigue sumando una repetición, que es la única progresión segura.
  const reps = increase ? prog.reps : prog.action === 'increase-weight' ? top.reps + 1 : prog.reps;

  return {
    weight,
    baseWeight: top.weight,
    reps,
    action: increase ? 'increase' : 'hold',
    deltaPct: top.weight > 0 ? Math.round(((weight - top.weight) / top.weight) * 1000) / 10 : 0,
    reasonKey: increase ? 'coach.reason.no_effort_increase' : 'coach.reason.no_effort_reps',
    confidence: 'low',
  };
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
        bucket.rirs.length > 0
          ? bucket.rirs.reduce((a, b) => a + b, 0) / bucket.rirs.length
          : null,
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
