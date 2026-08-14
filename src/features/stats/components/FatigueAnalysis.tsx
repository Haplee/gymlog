import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { MuscleGroupStatus, RecoveryStatus } from '../utils/fatigueAnalysis';
import { MuscleGroupIcon } from '@shared/components/CardioIcons';
import { MUSCLE_COLORS } from '@shared/constants/muscleColors';
import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';
import { AlertTriangle, CheckCircle, Flash, TrendUp, XCircle } from '@shared/components/icons';

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
  const { t } = useTranslation();
  const getStatusConfig = (status: RecoveryStatus) => {
    switch (status) {
      // Recién entrenado: la barra de recuperación está a ~0%, así que el
      // rótulo tiene que decir lo mismo que la barra.
      case 'recovering':
        return {
          color: 'var(--error)',
          bgColor: 'rgba(255, 69, 58, 0.1)',
          icon: XCircle,
          label: t('userStats.recovery_recovering'),
        };
      case 'partial':
        return {
          color: 'var(--warning)',
          bgColor: 'rgba(255, 214, 10, 0.1)',
          icon: AlertTriangle,
          label: t('userStats.recovery_partial'),
        };
      case 'recovered':
        return {
          color: 'var(--success)',
          bgColor: 'rgba(48, 209, 88, 0.1)',
          icon: CheckCircle,
          label: t('userStats.recovery_rested'),
        };
    }
  };

  const getRecoveryPercentage = (daysSinceLast: number): number => {
    if (daysSinceLast === -1) return 0;
    const maxRecoveryDays = 7;
    return Math.min(100, Math.round((daysSinceLast / maxRecoveryDays) * 100));
  };

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface rounded-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flash className="w-5 h-5 text-accent" />
          <div className="text-base font-semibold text-fg">
            {t('userStats.recovery_card_title')}
          </div>
        </div>
        <div className="text-xs text-fg-subtle">
          {daysSinceLastWorkout === 0
            ? t('common.today')
            : daysSinceLastWorkout === 1
              ? t('common.yesterday')
              : t('userStats.days_since_full', { count: daysSinceLastWorkout })}
        </div>
      </div>

      {daysSinceLastWorkout > 3 && (
        <m.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-2 px-4 py-3 rounded-card mb-4"
          style={{ backgroundColor: 'rgba(255, 214, 10, 0.1)' }}
        >
          <AlertTriangle className="w-5 h-5 text-warning" />
          <div className="text-sm text-warning">
            <span className="font-semibold">{daysSinceLastWorkout}</span>{' '}
            {t('userStats.days_without_training')}
          </div>
        </m.div>
      )}

      <div className="space-y-2.5">
        {muscleGroups.slice(0, 6).map((mg, index) => {
          const config = getStatusConfig(mg.status);
          const Icon = config.icon;
          const recoveryPercent = getRecoveryPercentage(mg.daysSinceLast);
          const muscleColor = MUSCLE_COLORS[mg.name] ?? 'var(--interactive-primary)';

          return (
            <m.div
              key={mg.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3 p-2.5 rounded-card"
              style={{ backgroundColor: config.bgColor }}
            >
              {/* Icono anatómico con fondo coloreado */}
              <div
                className="flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center"
                style={{ backgroundColor: `${muscleColor}22` }}
              >
                <div style={{ color: muscleColor }}>
                  <MuscleGroupIcon name={mg.name} className="w-6 h-6" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-fg">{mg.name}</span>
                  <div className="flex items-center gap-1 ml-2">
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: config.color }} />
                    <span className="text-xs whitespace-nowrap" style={{ color: config.color }}>
                      {config.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <m.div
                      initial={{ width: 0 }}
                      animate={{ width: `${recoveryPercent}%` }}
                      transition={{ delay: 0.3 + index * 0.1, duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: muscleColor, opacity: 0.85 }}
                    />
                  </div>
                  <span className="text-2xs text-fg-subtle w-8 text-right flex-shrink-0">
                    {mg.daysSinceLast === -1
                      ? '—'
                      : mg.daysSinceLast === 0
                        ? t('common.today')
                        : mg.daysSinceLast === 1
                          ? t('common.yesterday')
                          : `${mg.daysSinceLast}d`}
                  </span>
                </div>
              </div>
            </m.div>
          );
        })}
      </div>

      {suggestedGroup && (
        <m.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 pt-4 border-t border-line"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendUp className="w-4 h-4 text-accent" />
            <div className="text-xs font-medium text-fg-subtle uppercase tracking-wide">
              {t('userStats.suggestion_today')}
            </div>
          </div>
          {(() => {
            const suggColor = MUSCLE_COLORS[suggestedGroup ?? ''] ?? 'var(--interactive-primary)';
            return (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-card"
                style={{ backgroundColor: `${suggColor}18` }}
              >
                <div
                  className="w-11 h-11 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${suggColor}28`, color: suggColor }}
                >
                  <MuscleGroupIcon
                    name={suggestedGroup ?? DEFAULT_MUSCLE_GROUP}
                    className="w-7 h-7"
                  />
                </div>
                <div>
                  <div className="text-base font-semibold" style={{ color: suggColor }}>
                    {t('userStats.train_muscle', { muscle: suggestedGroup })}
                  </div>
                  <div className="text-xs text-fg-muted">{t('userStats.muscle_recovered')}</div>
                </div>
              </div>
            );
          })()}
        </m.div>
      )}
    </m.div>
  );
}
