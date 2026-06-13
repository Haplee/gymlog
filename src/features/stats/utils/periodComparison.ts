import type { VolumeSet } from './kpiCalculations';
import { isWorkingSet } from './kpiCalculations';
import { toLocalDateKey } from '@shared/lib/dateKeys';

export interface PeriodStats {
  volume: number;
  sessions: number;
}

export interface PeriodComparison {
  current: PeriodStats;
  previous: PeriodStats;
  volumeChangePct: number;
  sessionChangePct: number;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function statsInWindow(sets: VolumeSet[], from: Date, to: Date): PeriodStats {
  const working = sets.filter(isWorkingSet).filter((s) => {
    const startedAt = s.workout?.started_at;
    if (!startedAt) return false;
    const d = new Date(startedAt);
    return d >= from && d < to;
  });
  const volume = working.reduce((sum, s) => sum + s.weight * s.reps, 0);
  const days = new Set<string>();
  for (const s of working) {
    const startedAt = s.workout?.started_at;
    if (startedAt) days.add(toLocalDateKey(new Date(startedAt)));
  }
  return { volume, sessions: days.size };
}

/**
 * Compara dos ventanas consecutivas de `windowDays` días: la actual
 * [now-windowDays, now] frente a la anterior [now-2·windowDays, now-windowDays].
 */
export function comparePeriods(
  sets: VolumeSet[],
  windowDays = 30,
  now: Date = new Date(),
): PeriodComparison {
  const ms = windowDays * 24 * 60 * 60 * 1000;
  const currentFrom = new Date(now.getTime() - ms);
  const previousFrom = new Date(now.getTime() - 2 * ms);

  const current = statsInWindow(sets, currentFrom, now);
  const previous = statsInWindow(sets, previousFrom, currentFrom);

  return {
    current,
    previous,
    volumeChangePct: pctChange(current.volume, previous.volume),
    sessionChangePct: pctChange(current.sessions, previous.sessions),
  };
}
