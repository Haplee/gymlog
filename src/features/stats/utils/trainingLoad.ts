/**
 * Contexto de volumen semanal: el freno que le faltaba a la sugerencia de carga.
 *
 * El motor decidía mirando solo al ejercicio: si la última serie llegó al techo
 * del rango, subir peso. Eso ignora la pregunta que de verdad importa —«¿cuánto
 * trabajo lleva encima ese músculo esta semana?»— y produce el efecto que se ve
 * en la app: subir carga todas las semanas hasta que algo se rompe.
 *
 * Aquí se calculan dos señales complementarias, ambas sobre **series duras**
 * (series de trabajo, sin calentamientos), que es la unidad con la que trabaja
 * la literatura de volumen:
 *
 *  - **Landmarks de volumen (MEV / MAV / MRV).** Por debajo del MEV el músculo
 *    no recibe estímulo suficiente y el problema no es la carga, son las series.
 *    Por encima del MRV la fatiga acumulada supera lo que se recupera y añadir
 *    carga es echar gasolina. Los rangos habituales en sujetos entrenados son
 *    4–8 series semanales de MEV, 10–20 de zona adaptativa y rendimientos
 *    decrecientes rápidos por encima de 20.
 *  - **Cociente agudo:crónico (ACWR).** Compara la semana en curso con la media
 *    de las cuatro últimas. El metaanálisis de 2025 (22 estudios de cohorte)
 *    confirma más incidencia de lesión por encima de 1,5 y una zona de menor
 *    incidencia entre 0,8 y 1,3. Viene de deportes de equipo, no de sala de
 *    pesas, así que aquí se usa como **freno**, nunca como objetivo: solo puede
 *    convertir una subida en un mantenimiento, jamás forzar una bajada.
 *
 * Todo es cálculo local y determinista. Sigue funcionando con el entrenador IA
 * apagado, igual que el resto de la capa 0.
 */

import type { LoadSuggestion } from './autoregulation';

/** Series semanales por debajo de las cuales el músculo no recibe estímulo. */
export const MEV_WEEKLY_SETS = 6;
/** Suelo de la zona adaptativa (MAV). */
export const MAV_MIN_WEEKLY_SETS = 10;
/** Techo de la zona adaptativa: a partir de aquí los retornos caen rápido. */
export const MAV_MAX_WEEKLY_SETS = 20;
/** Volumen máximo recuperable estimado: por encima, la fatiga gana. */
export const MRV_WEEKLY_SETS = 22;

/** Suelo de la zona de menor incidencia de lesión del ACWR. */
export const ACWR_LOW = 0.8;
/** Techo de esa zona. */
export const ACWR_HIGH = 1.3;
/** A partir de aquí el metaanálisis describe un pico de riesgo. */
export const ACWR_SPIKE = 1.5;

/** Semanas que forman la carga crónica. */
export const CHRONIC_WEEKS = 4;
/**
 * Series crónicas mínimas para que el cociente signifique algo.
 *
 * Sin esto, quien vuelve de un parón tiene una crónica cercana a cero y
 * cualquier semana normal sale como «pico»: el freno se dispararía justo con
 * quien más margen tiene para progresar.
 */
const MIN_CHRONIC_SETS = 3;

const DAY_MS = 86_400_000;

/** Una serie de trabajo situada en el tiempo y atribuida a un músculo. */
export interface VolumeSet {
  /** Fecha ISO de la sesión. */
  date: string;
  muscleGroup: string;
}

export type VolumeZone =
  /** Se entrena bastante menos que de costumbre (ACWR < 0,8). */
  | 'detrained'
  /** Dentro de la zona de menor riesgo. */
  | 'steady'
  /** Subiendo por encima de lo habitual, aún sin pico (1,3–1,5). */
  | 'ramping'
  /** Pico de carga (> 1,5). */
  | 'spike'
  /** Sin historial suficiente para juzgar. */
  | 'unknown';

export type VolumeLandmark = 'below-mev' | 'productive' | 'near-mrv' | 'above-mrv';

export interface VolumeContext {
  muscleGroup: string;
  /** Series duras de los últimos 7 días. */
  acuteSets: number;
  /** Media semanal de las últimas 4 semanas. */
  chronicSets: number;
  /** Agudo ÷ crónico, o `null` si no hay base suficiente. */
  acwr: number | null;
  zone: VolumeZone;
  landmark: VolumeLandmark;
  /** El volumen desaconseja subir carga esta semana. */
  holdLoad: boolean;
  /** Clave i18n del motivo, cuando hay algo que decir. */
  reasonKey: string | null;
}

function landmarkFor(weeklySets: number): VolumeLandmark {
  if (weeklySets < MEV_WEEKLY_SETS) return 'below-mev';
  if (weeklySets > MRV_WEEKLY_SETS) return 'above-mrv';
  if (weeklySets > MAV_MAX_WEEKLY_SETS) return 'near-mrv';
  return 'productive';
}

function zoneFor(acwr: number | null): VolumeZone {
  if (acwr === null) return 'unknown';
  if (acwr > ACWR_SPIKE) return 'spike';
  if (acwr > ACWR_HIGH) return 'ramping';
  if (acwr < ACWR_LOW) return 'detrained';
  return 'steady';
}

/**
 * Contexto de volumen de un grupo muscular.
 *
 * Devuelve `null` cuando ese músculo no aparece en la ventana: sin datos no se
 * frena nada, que es preferible a frenar por una ausencia.
 */
export function buildVolumeContext(
  sets: VolumeSet[],
  muscleGroup: string,
  now: Date = new Date(),
): VolumeContext | null {
  if (!muscleGroup) return null;
  const target = muscleGroup.trim().toLowerCase();
  const nowMs = now.getTime();

  let acuteSets = 0;
  let chronicTotal = 0;
  for (const s of sets) {
    if (s.muscleGroup.trim().toLowerCase() !== target) continue;
    const ts = new Date(s.date).getTime();
    if (Number.isNaN(ts)) continue;
    const days = (nowMs - ts) / DAY_MS;
    if (days < 0 || days > CHRONIC_WEEKS * 7) continue;
    chronicTotal++;
    if (days <= 7) acuteSets++;
  }

  if (chronicTotal === 0) return null;

  const chronicSets = chronicTotal / CHRONIC_WEEKS;
  const acwr =
    chronicSets >= MIN_CHRONIC_SETS ? Math.round((acuteSets / chronicSets) * 100) / 100 : null;

  const zone = zoneFor(acwr);
  const landmark = landmarkFor(acuteSets);

  // Un pico de cociente con volumen ridículo no es un pico: pasar de 1 a 3
  // series sale a 3,0 de ACWR y no significa nada. Se exige además estar por
  // encima del mínimo efectivo para que el freno se active.
  const spiking = zone === 'spike' && acuteSets >= MEV_WEEKLY_SETS;
  const overMrv = landmark === 'above-mrv';
  const holdLoad = spiking || overMrv;

  const reasonKey = overMrv
    ? 'coach.reason.volume_over_mrv'
    : spiking
      ? 'coach.reason.volume_spike'
      : landmark === 'below-mev'
        ? 'coach.reason.volume_below_mev'
        : null;

  return { muscleGroup, acuteSets, chronicSets, acwr, zone, landmark, holdLoad, reasonKey };
}

/**
 * Aplica el freno de volumen a una sugerencia de carga.
 *
 * Solo actúa en un sentido: convierte una subida en mantenimiento. Nunca
 * transforma un mantenimiento en bajada ni toca una bajada ya decidida — el
 * volumen es un dato de contexto, y la señal de que hay que recortar de verdad
 * la da el esfuerzo del propio ejercicio, que es más específico.
 */
export function applyVolumeContext(
  suggestion: LoadSuggestion | null,
  context: VolumeContext | null,
): LoadSuggestion | null {
  if (!suggestion || !context?.holdLoad) return suggestion;
  if (suggestion.action !== 'increase') return suggestion;

  return {
    ...suggestion,
    action: 'hold',
    weight: suggestion.baseWeight,
    reps: suggestion.baseReps,
    deltaPct: 0,
    reasonKey: context.reasonKey ?? 'coach.reason.volume_spike',
  };
}
