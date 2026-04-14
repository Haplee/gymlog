import type { WorkoutWithSets } from '@shared/lib/types';

export function calculateCurrentStreak(workouts: WorkoutWithSets[]): number {
  if (workouts.length === 0) return 0;

  const dates = [
    ...new Set(workouts.map((w) => new Date(w.started_at).toISOString().split('T')[0])),
  ]
    .sort()
    .reverse();

  const today = new Date().toISOString().split('T')[0];
  let streak = 0;

  for (let i = 0; i < dates.length; i++) {
    const diff =
      i === 0
        ? 0
        : (new Date(dates[i - 1]).getTime() - new Date(dates[i]).getTime()) / (1000 * 60 * 60 * 24);

    if (diff === 1 || (i === 0 && dates[0] === today)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export function calculateMaxStreak(workouts: WorkoutWithSets[]): number {
  if (workouts.length === 0) return 0;

  const dates = [
    ...new Set(workouts.map((w) => new Date(w.started_at).toISOString().split('T')[0])),
  ]
    .sort()
    .reverse();

  let maxStreak = 0;
  let temp = 1;

  for (let i = 1; i < dates.length; i++) {
    const diff =
      (new Date(dates[i - 1]).getTime() - new Date(dates[i]).getTime()) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      temp++;
    } else {
      maxStreak = Math.max(maxStreak, temp);
      temp = 1;
    }
  }

  return Math.max(maxStreak, temp);
}

export function calculateWeeklyVolume(
  sets: { weight: number; reps: number; workout?: { started_at: string } }[],
): number {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  return sets
    .filter((s) => s.workout && new Date(s.workout.started_at) >= weekStart)
    .reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export function calculatePreviousWeekVolume(
  sets: { weight: number; reps: number; workout?: { started_at: string } }[],
): number {
  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay());
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

  return sets
    .filter((s) => {
      if (!s.workout) return false;
      const d = new Date(s.workout.started_at);
      return d >= lastWeekStart && d <= lastWeekEnd;
    })
    .reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export function calculateSessionCountLast30Days(workouts: WorkoutWithSets[]): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return workouts.filter((w) => new Date(w.started_at) >= thirtyDaysAgo).length;
}

export function calculateVolumeChangePercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
