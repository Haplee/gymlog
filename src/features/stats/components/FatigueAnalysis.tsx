import { motion } from 'framer-motion';
import type { MuscleGroupStatus } from '../utils/fatigueAnalysis';

interface FatigueAnalysisProps {
  muscleGroups: MuscleGroupStatus[];
  daysSinceLastWorkout: number;
  suggestedGroup: string | null;
}

export function FatigueAnalysis({
  muscleGroups,
  daysSinceLastWorkout,
  suggestedGroup,
}: FatigueAnalysisProps) {
  const statusColors = {
    fresh: 'text-[var(--success)]',
    moderate: 'text-[var(--warning)]',
    'needs-attention': 'text-[var(--error)]',
  };

  const statusIcons = {
    fresh: '🟢',
    moderate: '🟡',
    'needs-attention': '🔴',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] p-4"
    >
      <div className="text-[0.8125rem] font-medium mb-3 text-[var(--text-secondary)]">
        Recuperación
      </div>

      {daysSinceLastWorkout > 3 && (
        <div className="text-[0.75rem] text-[var(--warning)] bg-[var(--warning)]/10 px-3 py-2 rounded-[var(--radius-md)] mb-3">
          ⚠️ {daysSinceLastWorkout} días sin entrenar
        </div>
      )}

      <div className="space-y-2">
        {muscleGroups.slice(0, 5).map((mg) => (
          <div key={mg.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={statusColors[mg.status]}>{statusIcons[mg.status]}</span>
              <span className="text-[0.8125rem] text-[var(--text-secondary)]">{mg.name}</span>
            </div>
            <span className="text-[0.6875rem] text-[var(--text-tertiary)]">
              {mg.daysSinceLast === -1 ? 'Sin datos' : `hace ${mg.daysSinceLast} días`}
            </span>
          </div>
        ))}
      </div>

      {suggestedGroup && (
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
          <div className="text-[0.6875rem] text-[var(--text-tertiary)] mb-1">
            Sugerencia para hoy
          </div>
          <div className="text-[0.875rem] font-medium text-[var(--interactive-primary)]">
            🎯 Entrenar {suggestedGroup}
          </div>
        </div>
      )}
    </motion.div>
  );
}
