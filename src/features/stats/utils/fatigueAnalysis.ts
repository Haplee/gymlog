import type { WeightedMuscle } from './muscleDistribution';
import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';

/**
 * Estado de recuperación de un grupo muscular, derivado de los días
 * transcurridos desde la última vez que se trabajó.
 *
 * Los nombres describen **recuperación**, que es lo que se muestra al usuario:
 * más días sin entrenar ⇒ más recuperado. Antes se llamaban `fresh` /
 * `needs-attention` (semántica de *recencia*), y la capa de presentación los
 * traducía al revés: un músculo entrenado hoy salía como "Recuperado".
 */
export type RecoveryStatus =
  /** Entrenado hace ≤2 días: aún acusa el trabajo, no toca repetir. */
  | 'recovering'
  /** 3-4 días: casi listo. */
  | 'partial'
  /** ≥5 días (o nunca entrenado): recuperado, es el candidato a entrenar. */
  | 'recovered';

export interface MuscleGroupStatus {
  name: string;
  daysSinceLast: number;
  status: RecoveryStatus;
}

interface RecoverySet {
  exercise_id?: string | null;
  exercise?: { muscle_group?: string };
  workout?: { started_at: string | null };
}

/** Grupos musculares que una serie entrena (todos los ponderados, o el único). */
function musclesForSet(s: RecoverySet, musclesMap?: Record<string, WeightedMuscle[]>): string[] {
  const weighted = s.exercise_id ? musclesMap?.[s.exercise_id] : undefined;
  if (weighted && weighted.length > 0) {
    return [...new Set(weighted.map((m) => m.muscle_group))];
  }
  return [s.exercise?.muscle_group || DEFAULT_MUSCLE_GROUP];
}

/** Días transcurridos → estado de recuperación. Umbrales en un único sitio. */
export function recoveryStatusFor(daysSinceLast: number): RecoveryStatus {
  // -1 = sin datos: nunca entrenado ⇒ recuperado por definición.
  if (daysSinceLast < 0) return 'recovered';
  if (daysSinceLast <= 2) return 'recovering';
  if (daysSinceLast <= 4) return 'partial';
  return 'recovered';
}

export function analyzeMuscleRecovery(
  sets: RecoverySet[],
  /**
   * Opcional: mapa `exercise_id → músculos ponderados`. Si está presente, cada
   * serie cuenta para la recencia de TODOS los músculos del ejercicio (presencia,
   * no peso). Si falta, se usa el `muscle_group` único (retrocompatible).
   */
  musclesMap?: Record<string, WeightedMuscle[]>,
): MuscleGroupStatus[] {
  const now = new Date();
  // Última fecha entrenada por grupo muscular.
  const lastByGroup = new Map<string, number>();
  for (const s of sets) {
    const dateStr = s.workout?.started_at;
    const ts = dateStr ? new Date(dateStr).getTime() : 0;
    for (const mg of musclesForSet(s, musclesMap)) {
      const prev = lastByGroup.get(mg) ?? 0;
      if (ts > prev) lastByGroup.set(mg, ts);
    }
  }

  if (lastByGroup.size === 0) {
    return [{ name: DEFAULT_MUSCLE_GROUP, daysSinceLast: -1, status: recoveryStatusFor(-1) }];
  }

  const result: MuscleGroupStatus[] = [];
  for (const [mg, ts] of lastByGroup) {
    const daysSince = Math.floor((now.getTime() - ts) / (1000 * 60 * 60 * 24));
    result.push({ name: mg, daysSinceLast: daysSince, status: recoveryStatusFor(daysSince) });
  }

  // Recién entrenados primero (menos días), recuperados al final.
  return result.sort((a, b) => a.daysSinceLast - b.daysSinceLast);
}

/** Primer grupo muscular ya recuperado, si lo hay: el candidato a entrenar hoy. */
export function getSuggestedMuscleGroup(recoveryData: MuscleGroupStatus[]): string | null {
  const recovered = recoveryData.filter((m) => m.status === 'recovered');
  if (recovered.length === 0) return null;
  return recovered[0].name;
}

export function getDaysSinceLastWorkout(workouts: { started_at: string | null }[]): number {
  if (workouts.length === 0) return -1;

  const lastWorkout = workouts.reduce((latest, w) => {
    const d = new Date(w.started_at ?? '');
    return d > latest ? d : latest;
  }, new Date(0));

  return Math.floor((new Date().getTime() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24));
}
