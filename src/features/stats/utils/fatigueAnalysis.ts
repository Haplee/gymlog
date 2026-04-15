export interface MuscleGroupStatus {
  name: string;
  daysSinceLast: number;
  status: 'fresh' | 'moderate' | 'needs-attention';
}

export function analyzeMuscleRecovery(
  sets: { exercise?: { muscle_group?: string }; workout?: { started_at: string | null } }[],
): MuscleGroupStatus[] {
  const muscleGroups = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Otro'];
  const now = new Date();
  const result: MuscleGroupStatus[] = [];

  muscleGroups.forEach((mg) => {
    const mgSets = sets.filter((s) => s.exercise?.muscle_group === mg);

    if (mgSets.length === 0) {
      result.push({ name: mg, daysSinceLast: -1, status: 'needs-attention' });
      return;
    }

    const lastSet = mgSets.reduce((latest, s) => {
      const dateStr = s.workout?.started_at;
      if (!dateStr) return latest;
      const setDate = new Date(dateStr);
      return setDate > latest ? setDate : latest;
    }, new Date(0));

    const daysSince = Math.floor((now.getTime() - lastSet.getTime()) / (1000 * 60 * 60 * 24));

    let status: 'fresh' | 'moderate' | 'needs-attention';
    if (daysSince <= 2) status = 'fresh';
    else if (daysSince <= 4) status = 'moderate';
    else status = 'needs-attention';

    result.push({ name: mg, daysSinceLast: daysSince, status });
  });

  return result.sort((a, b) => b.daysSinceLast - a.daysSinceLast);
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
