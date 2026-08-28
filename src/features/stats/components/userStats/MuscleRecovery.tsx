import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { MuscleGroupStatus } from '@features/stats/utils/fatigueAnalysis';
import { muscleGroupLabel } from '@shared/lib/muscleGroupLabel';
import { SectionLabel } from './SectionLabel';

export function MuscleRecovery({ muscleRecovery }: { muscleRecovery: MuscleGroupStatus[] }) {
  const { t } = useTranslation();
  if (muscleRecovery.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionLabel>{t('userStats.recovery_title')}</SectionLabel>
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-card p-4 bg-surface border border-line shadow-card"
      >
        <div className="space-y-2">
          {muscleRecovery.slice(0, 6).map(({ name, daysSinceLast, status }) => {
            const colors = {
              recovering: {
                dot: 'var(--error)',
                label: t('userStats.recovery_recovering'),
                bg: 'color-mix(in srgb, var(--error) 10%, transparent)',
              },
              partial: {
                dot: 'var(--warning)',
                label: t('userStats.recovery_partial'),
                bg: 'color-mix(in srgb, var(--warning) 10%, transparent)',
              },
              recovered: {
                dot: 'var(--success)',
                label: t('userStats.recovery_rested'),
                bg: 'color-mix(in srgb, var(--success) 10%, transparent)',
              },
            }[status];
            return (
              <div
                key={name}
                className="flex items-center justify-between p-2.5 rounded-md"
                style={{ backgroundColor: colors.bg }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.dot }} />
                  <span className="text-sm font-medium text-fg">{muscleGroupLabel(name, t)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-fg-subtle">
                    {daysSinceLast >= 0
                      ? t('userStats.days_ago', { count: daysSinceLast })
                      : t('userStats.no_data_label')}
                  </span>
                  <span
                    className="text-2xs font-semibold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${colors.dot} 13%, transparent)`,
                      color: colors.dot,
                    }}
                  >
                    {colors.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </m.div>
    </section>
  );
}
