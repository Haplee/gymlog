import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SectionLabel } from './SectionLabel';
import { Flash } from '@shared/components/icons';

export interface DayFrequencyItem {
  day: string;
  count: number;
  pct: number;
}

export function DayFrequencyChart({
  data,
  bestDay,
}: {
  data: DayFrequencyItem[];
  bestDay: string | null;
}) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3">
      <SectionLabel>{t('userStats.day_frequency_title')}</SectionLabel>
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-card p-4 bg-surface"
      >
        {bestDay && (
          <div className="flex items-center gap-2 mb-4">
            <Flash className="w-4 h-4" style={{ color: 'var(--accent-amber)' }} />
            <span className="text-sm font-medium text-fg-muted">
              {t('userStats.favorite_day')} <span className="font-bold text-fg">{bestDay}</span>
            </span>
          </div>
        )}
        <div className="space-y-2.5">
          {data.map(({ day, count, pct }, i) => (
            <div key={day}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm w-8 text-fg-muted">{day}</span>
                <div className="flex-1 mx-3 h-2 rounded-full overflow-hidden bg-surface-2">
                  <m.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.45 + i * 0.04, duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor:
                        pct === 100
                          ? 'var(--interactive-primary)'
                          : pct > 60
                            ? 'var(--accent-orange)'
                            : 'var(--accent-sky)',
                    }}
                  />
                </div>
                <span className="text-xs font-mono w-6 text-right text-fg-subtle">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </m.div>
    </section>
  );
}
