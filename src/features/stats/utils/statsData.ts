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

import { distributeVolume, type WeightedMuscle } from './muscleDistribution';
import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';

export function calculateMuscleGroupDistribution(
  sets: {
    weight: number;
    reps: number;
    is_warmup?: boolean | null;
    exercise_id?: string | null;
    exercise?: { muscle_group?: string | null } | null;
  }[],
  /**
   * Opcional: mapa `exercise_id → músculos ponderados`. Si está presente, el
   * volumen de cada serie se reparte entre esos músculos según su peso. Si falta
   * (o no cubre el exercise_id), se cae al `muscle_group` único (comportamiento
   * previo, retrocompatible).
   */
  musclesMap?: Record<string, WeightedMuscle[]>,
) {
  const distribution: Record<string, number> = {};
  sets
    .filter((s) => !s.is_warmup)
    .forEach((s) => {
      const volume = s.weight * s.reps;
      const muscles = s.exercise_id ? musclesMap?.[s.exercise_id] : undefined;
      if (muscles && muscles.length > 0) {
        const shares = distributeVolume(volume, muscles);
        for (const [name, value] of Object.entries(shares)) {
          distribution[name] = (distribution[name] || 0) + value;
        }
      } else {
        const muscleGroup = s.exercise?.muscle_group || DEFAULT_MUSCLE_GROUP;
        distribution[muscleGroup] = (distribution[muscleGroup] || 0) + volume;
      }
    });
  return Object.entries(distribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
