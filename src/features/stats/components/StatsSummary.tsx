import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

export interface StagnantExercise {
  id: string;
  name: string;
  weeks: number;
}

export function StatsSummary({
  maxStreak,
  totalPRs,
  stagnantExercises,
}: {
  maxStreak: number;
  totalPRs: number;
  stagnantExercises: StagnantExercise[];
}) {
  const { t } = useTranslation();
  return (
    <>
      {/* Racha max + PRs */}
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="relative overflow-hidden rounded-card p-4 bg-surface">
          <div
            className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-card"
            style={{ backgroundColor: 'var(--warning)' }}
          />
          <div className="pl-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                {t('stats.max_streak')}
              </span>
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                style={{ stroke: 'var(--warning)' }}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            </div>
            <div
              className="font-mono font-bold leading-none tabular-nums"
              style={{ fontSize: '2.25rem', color: 'var(--text-primary)' }}
            >
              {maxStreak}
            </div>
            <div className="mt-2 text-xs text-fg-subtle">{t('stats.days')}</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-card p-4 bg-surface">
          <div
            className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-card"
            style={{ backgroundColor: 'var(--interactive-primary)' }}
          />
          <div className="pl-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                {t('stats.personal_records')}
              </span>
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                style={{ stroke: 'var(--interactive-primary)' }}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M8 20l4-4 4 4" />
                <line x1="12" y1="16" x2="12" y2="20" />
              </svg>
            </div>
            <div
              className="font-mono font-bold leading-none tabular-nums"
              style={{ fontSize: '2.25rem', color: 'var(--interactive-primary)' }}
            >
              {totalPRs}
            </div>
            <div className="mt-2 text-xs text-fg-subtle">{t('stats.total_prs')}</div>
          </div>
        </div>
      </m.div>

      {stagnantExercises.length > 0 && (
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-card p-4 bg-surface border border-line"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-sm font-semibold text-fg">{t('stats.possible_stall')}</span>
          </div>
          <div className="space-y-2">
            {stagnantExercises.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between">
                <span className="text-sm text-fg-muted truncate pr-2">{ex.name}</span>
                <span className="text-xs font-mono tabular-nums text-warning flex-shrink-0">
                  {t('stats.weeks_without_pr', { count: ex.weeks })}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-fg-subtle mt-3">{t('stats.stall_tip')}</p>
        </m.div>
      )}
    </>
  );
}
