import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp, Zap } from 'lucide-react';
import type { MuscleGroupStatus } from '../utils/fatigueAnalysis';
import { MuscleGroupIcon } from '@shared/components/CardioIcons';

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
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'fresh':
        return {
          color: 'var(--success)',
          bgColor: 'rgba(48, 209, 88, 0.1)',
          icon: CheckCircle2,
          label: 'Recuperado',
        };
      case 'moderate':
        return {
          color: 'var(--warning)',
          bgColor: 'rgba(255, 214, 10, 0.1)',
          icon: AlertTriangle,
          label: 'Moderado',
        };
      case 'needs-attention':
        return {
          color: 'var(--error)',
          bgColor: 'rgba(255, 69, 58, 0.1)',
          icon: XCircle,
          label: 'Necesita atención',
        };
      default:
        return {
          color: 'var(--text-tertiary)',
          bgColor: 'transparent',
          icon: CheckCircle2,
          label: 'Desconocido',
        };
    }
  };

  const getRecoveryPercentage = (daysSinceLast: number): number => {
    if (daysSinceLast === -1) return 0;
    const maxRecoveryDays = 7;
    return Math.min(100, Math.round((daysSinceLast / maxRecoveryDays) * 100));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5" style={{ color: 'var(--interactive-primary)' }} />
          <div className="text-[0.9375rem] font-semibold text-[var(--text-primary)]">
            Recuperación
          </div>
        </div>
        <div className="text-xs text-[var(--text-tertiary)]">
          {daysSinceLastWorkout === 0
            ? 'Hoy'
            : daysSinceLastWorkout === 1
              ? 'Ayer'
              : `Hace ${daysSinceLastWorkout} días`}
        </div>
      </div>

      {daysSinceLastWorkout > 3 && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-2 px-4 py-3 rounded-[var(--radius-lg)] mb-4"
          style={{ backgroundColor: 'rgba(255, 214, 10, 0.1)' }}
        >
          <AlertTriangle className="w-5 h-5" style={{ color: 'var(--warning)' }} />
          <div className="text-sm" style={{ color: 'var(--warning)' }}>
            <span className="font-semibold">{daysSinceLastWorkout} días</span> sin entrenar
          </div>
        </motion.div>
      )}

      <div className="space-y-3">
        {muscleGroups.slice(0, 6).map((mg, index) => {
          const config = getStatusConfig(mg.status);
          const Icon = config.icon;
          const recoveryPercent = getRecoveryPercentage(mg.daysSinceLast);

          return (
            <motion.div
              key={mg.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-[var(--radius-lg)]"
              style={{ backgroundColor: config.bgColor }}
            >
              <div style={{ color: 'var(--interactive-primary)' }}>
                <MuscleGroupIcon name={mg.name} className="w-5 h-5" />
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[0.875rem] font-medium text-[var(--text-primary)]">
                    {mg.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                    <span className="text-[0.6875rem]" style={{ color: config.color }}>
                      {config.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-surface-2)] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${recoveryPercent}%` }}
                      transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                  </div>
                  <span className="text-[0.625rem] text-[var(--text-tertiary)] w-8 text-right">
                    {mg.daysSinceLast === -1
                      ? '—'
                      : mg.daysSinceLast === 0
                        ? 'Hoy'
                        : mg.daysSinceLast === 1
                          ? 'Ayer'
                          : `${mg.daysSinceLast}d`}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {suggestedGroup && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 pt-4 border-t border-[var(--border-subtle)]"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--interactive-primary)' }} />
            <div className="text-[0.75rem] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
              Sugerencia para hoy
            </div>
          </div>
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)]"
            style={{ backgroundColor: 'rgba(200, 255, 0, 0.1)' }}
          >
            <MuscleGroupIcon name={suggestedGroup ?? 'Otro'} className="w-6 h-6" />
            <div>
              <div
                className="text-[0.9375rem] font-semibold"
                style={{ color: 'var(--interactive-primary)' }}
              >
                Entrenar {suggestedGroup}
              </div>
              <div className="text-[0.75rem] text-[var(--text-secondary)]">
                Grupo muscular recuperado
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
