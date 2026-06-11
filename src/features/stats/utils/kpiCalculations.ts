import type { WorkoutWithSets } from '@shared/lib/types';
import { toLocalDateKey } from '@shared/lib/dateKeys';

function workoutDateKeys(workouts: WorkoutWithSets[]): Set<string> {
  const keys = new Set<string>();
  for (const w of workouts) {
    if (!w.started_at) continue;
    const d = new Date(w.started_at);
    if (!isNaN(d.getTime())) keys.add(toLocalDateKey(d));
  }
  return keys;
}

export function calculateCurrentStreak(workouts: WorkoutWithSets[]): number {
  if (workouts.length === 0) return 0;

  const dates = workoutDateKeys(workouts);

  // Anclar en hoy; si hoy no hay entreno, la racha sigue viva si entrenó ayer
  const cursor = new Date();
  if (!dates.has(toLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dates.has(toLocalDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (dates.has(toLocalDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function calculateMaxStreak(workouts: WorkoutWithSets[]): number {
  if (workouts.length === 0) return 0;

  const dates = [...workoutDateKeys(workouts)].sort();

  let maxStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const diff =
      (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      tempStreak++;
    } else {
      maxStreak = Math.max(maxStreak, tempStreak);
      tempStreak = 1;
    }
  }

  return Math.max(maxStreak, tempStreak);
}

export type VolumeSet = {
  weight: number;
  reps: number;
  is_warmup?: boolean | null;
  workout?: { started_at: string | null };
};

export const isWorkingSet = (s: { is_warmup?: boolean | null }) => !s.is_warmup;

export function calculateWeeklyVolume(sets: VolumeSet[]): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  return sets
    .filter(isWorkingSet)
    .filter((s) => s.workout?.started_at && new Date(s.workout.started_at) >= weekStart)
    .reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export function calculatePreviousWeekVolume(sets: VolumeSet[]): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - diffToMonday);
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  lastWeekEnd.setHours(23, 59, 59, 999);

  return sets
    .filter(isWorkingSet)
    .filter((s) => {
      const startedAt = s.workout?.started_at;
      if (!startedAt) return false;
      const d = new Date(startedAt);
      return d >= lastWeekStart && d <= lastWeekEnd;
    })
    .reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export function calculateSessionCountLast30Days(workouts: WorkoutWithSets[]): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return workouts.filter((w) => new Date(w.started_at ?? '') >= thirtyDaysAgo).length;
}

export function calculateVolumeChangePercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function calculateAverageSessionDuration(workouts: WorkoutWithSets[]): number {
  if (workouts.length === 0) return 0;

  const durations = workouts
    .map((w) => {
      const start = w.started_at ? new Date(w.started_at).getTime() : null;
      const end = w.ended_at ? new Date(w.ended_at).getTime() : null;
      if (!start || !end) return null;
      const diff = (end - start) / (1000 * 60);
      return diff > 0 ? diff : null;
    })
    .filter((d): d is number => d !== null);

  if (durations.length === 0) return 0;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

export function calculateTotalPRs(
  sets: { weight: number; reps: number; is_pr?: boolean | null }[],
): number {
  return sets.filter((s) => s.is_pr === true).length;
}

export function calculateTotalPRsFromRecords(
  prs: { exercise_id: string; achieved_at: string | null }[],
): number {
  if (!prs || prs.length === 0) return 0;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return prs.filter((pr) => {
    if (!pr.achieved_at) return false;
    return new Date(pr.achieved_at) >= thirtyDaysAgo;
  }).length;
}

export function calculateAllTimePRsCount(prs: { exercise_id: string }[]): number {
  return prs?.length ?? 0;
}
