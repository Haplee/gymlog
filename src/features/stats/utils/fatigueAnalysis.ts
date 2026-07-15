import type { WeightedMuscle } from './muscleDistribution';

export interface MuscleGroupStatus {
  name: string;
  daysSinceLast: number;
  status: 'fresh' | 'moderate' | 'needs-attention';
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
  return [s.exercise?.muscle_group || 'Otro'];
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
    return [{ name: 'Otro', daysSinceLast: -1, status: 'needs-attention' }];
  }

  const result: MuscleGroupStatus[] = [];
  for (const [mg, ts] of lastByGroup) {
    const daysSince = Math.floor((now.getTime() - ts) / (1000 * 60 * 60 * 24));
    let status: 'fresh' | 'moderate' | 'needs-attention';
    if (daysSince <= 2) status = 'fresh';
    else if (daysSince <= 4) status = 'moderate';
    else status = 'needs-attention';
    result.push({ name: mg, daysSinceLast: daysSince, status });
  }

  // Fresh muscles first (ascending daysSinceLast), needs-attention last
  return result.sort((a, b) => a.daysSinceLast - b.daysSinceLast);
}

export function getSuggestedMuscleGroup(recoveryData: MuscleGroupStatus[]): string | null {
  const needsAttention = recoveryData.filter((m) => m.status === 'needs-attention');
  if (needsAttention.length > 0) {
    return needsAttention[0].name;
  }
  return null;
}

export function getDaysSinceLastWorkout(workouts: { started_at: string | null }[]): number {
  if (workouts.length === 0) return -1;

  const lastWorkout = workouts.reduce((latest, w) => {
    const d = new Date(w.started_at ?? '');
    return d > latest ? d : latest;
  }, new Date(0));

  return Math.floor((new Date().getTime() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24));
}
