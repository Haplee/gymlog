import { calcular1RM } from '@shared/lib/brzycki';

export interface ProgressionDataPoint {
  date: string;
  value: number;
  isPR: boolean;
}

export function calculateEstimated1RM(weight: number, reps: number): number {
  return calcular1RM(weight, reps);
}

export function calculateMaxWeight(sets: { weight: number }[]): number {
  if (sets.length === 0) return 0;
  return Math.max(...sets.map((s) => s.weight));
}

export function calculateSessionVolume(sets: { weight: number; reps: number }[]): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export function buildProgressionData(
  sets: {
    weight: number;
    reps: number;
    exercise?: { name?: string };
    workout?: { started_at: string | null };
  }[],
  exerciseName: string,
  metric: '1rm' | 'maxWeight' | 'volume' = '1rm',
): ProgressionDataPoint[] {
  const exerciseSets = sets
    .filter((s) => s.exercise?.name === exerciseName)
    .sort((a, b) => {
      const dateA = a.workout?.started_at ? new Date(a.workout.started_at).getTime() : 0;
      const dateB = b.workout?.started_at ? new Date(b.workout.started_at).getTime() : 0;
      return dateA - dateB;
    });

  const byDate: Record<string, { weight: number; reps: number }[]> = {};

  exerciseSets.forEach((s) => {
    const date = s.workout?.started_at
      ? new Date(s.workout.started_at).toISOString().split('T')[0]
      : '';
    if (!date) return;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push({ weight: s.weight, reps: s.reps });
  });

  let maxValue = 0;
  const result: ProgressionDataPoint[] = [];

  Object.entries(byDate).forEach(([date, daySets]) => {
    let value: number;

    if (metric === '1rm') {
      value = Math.max(...daySets.map((s) => calculateEstimated1RM(s.weight, s.reps)));
    } else if (metric === 'maxWeight') {
      value = Math.max(...daySets.map((s) => s.weight));
    } else {
      value = daySets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    }

    const isPR = value > maxValue;
    if (isPR) maxValue = value;

    result.push({ date, value: Math.round(value * 10) / 10, isPR });
  });

  return result;
}

export function linearRegression(points: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
} {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0 };

  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}
