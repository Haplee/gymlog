// Datos y cálculos puros de StatsPage: filtros de periodo, formato de tiempo y
// distribución de volumen por grupo muscular. Sin JSX, testeable de forma aislada.

export type PeriodFilter = '4semanas' | '3meses' | '6meses' | '1año';

export const PERIOD_LABELS: Record<PeriodFilter, string> = {
  '4semanas': '4 sem',
  '3meses': '3 mes',
  '6meses': '6 mes',
  '1año': '1 año',
};

export const PERIOD_WEEKS: Record<PeriodFilter, number> = {
  '4semanas': 4,
  '3meses': 12,
  '6meses': 24,
  '1año': 52,
};

export function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function calculateMuscleGroupDistribution(
  sets: {
    weight: number;
    reps: number;
    is_warmup?: boolean | null;
    exercise?: { muscle_group?: string | null } | null;
  }[],
) {
  const distribution: Record<string, number> = {};
  sets
    .filter((s) => !s.is_warmup)
    .forEach((s) => {
      const muscleGroup = s.exercise?.muscle_group || 'Otro';
      const volume = s.weight * s.reps;
      distribution[muscleGroup] = (distribution[muscleGroup] || 0) + volume;
    });
  return Object.entries(distribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
