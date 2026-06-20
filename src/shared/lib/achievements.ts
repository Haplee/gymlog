// Logros: definiciones puras + cálculo de estado a partir de métricas del usuario.
// Los títulos/descripciones viven en i18n (claves achievements.<id>.*).

export interface AchievementInput {
  totalWorkouts: number;
  maxStreak: number;
  totalVolumeKg: number;
  prCount: number;
  sessions30d: number;
}

export type AchievementMetric = keyof AchievementInput;

export interface AchievementDef {
  id: string;
  metric: AchievementMetric;
  threshold: number;
  /** Clave de icono resuelta en la UI. */
  icon: string;
}

export interface AchievementStatus extends AchievementDef {
  value: number;
  unlocked: boolean;
  /** Progreso 0..1 hacia el umbral. */
  progress: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_workout', metric: 'totalWorkouts', threshold: 1, icon: 'dumbbell' },
  { id: 'workouts_10', metric: 'totalWorkouts', threshold: 10, icon: 'dumbbell' },
  { id: 'workouts_50', metric: 'totalWorkouts', threshold: 50, icon: 'dumbbell' },
  { id: 'workouts_100', metric: 'totalWorkouts', threshold: 100, icon: 'medal' },
  { id: 'streak_7', metric: 'maxStreak', threshold: 7, icon: 'flame' },
  { id: 'streak_30', metric: 'maxStreak', threshold: 30, icon: 'flame' },
  { id: 'volume_10t', metric: 'totalVolumeKg', threshold: 10_000, icon: 'weight' },
  { id: 'volume_100t', metric: 'totalVolumeKg', threshold: 100_000, icon: 'weight' },
  { id: 'pr_10', metric: 'prCount', threshold: 10, icon: 'trophy' },
  { id: 'consistent_month', metric: 'sessions30d', threshold: 12, icon: 'calendar' },
];

export function computeAchievements(input: AchievementInput): AchievementStatus[] {
  return ACHIEVEMENTS.map((def) => {
    const value = input[def.metric] ?? 0;
    const progress = def.threshold > 0 ? Math.min(1, Math.max(0, value / def.threshold)) : 0;
    return {
      ...def,
      value,
      unlocked: value >= def.threshold,
      progress,
    };
  });
}

/** IDs desbloqueados, útil para detectar logros nuevos. */
export function unlockedIds(statuses: AchievementStatus[]): string[] {
  return statuses.filter((s) => s.unlocked).map((s) => s.id);
}
