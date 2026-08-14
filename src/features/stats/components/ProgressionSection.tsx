import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { useWeight } from '@shared/hooks/useWeight';
import { ChevronDown } from '@shared/components/icons';

const ProgressionChart = lazy(() =>
  import('./Charts').then((mod) => ({ default: mod.ProgressionChart })),
);

type Metric = '1rm' | 'maxWeight' | 'volume';
const METRICS: Metric[] = ['1rm', 'maxWeight', 'volume'];

interface ProgressionSectionProps {
  exercises: string[];
  selectedExercise: string;
  onSelectExercise: (name: string) => void;
  activeExerciseName: string;
  /** Null cuando el ejercicio elegido no existe en el catálogo del usuario. */
  activeExerciseId: string | null;
  metric: Metric;
  onMetric: (metric: Metric) => void;
  expanded: boolean;
  onToggle: () => void;
  data: Parameters<typeof ProgressionChart>[0]['data'];
  /** Objetivo de 1RM en kg, o null si no hay ninguno fijado. */
  goal: number | null;
  currentBest1rm: number;
  goalInput: string;
  onGoalInput: (value: string) => void;
  onSaveGoal: () => void;
  onClearGoal: () => void;
}

/**
 * Progresión de un ejercicio y su objetivo de 1RM.
 *
 * Extraído de `StatsPage` por tamaño (CLAUDE.md fija 800 líneas). Es el bloque
 * con más estado de la página, así que se queda arriba: aquí solo se pinta.
 */
export function ProgressionSection({
  exercises,
  selectedExercise,
  onSelectExercise,
  activeExerciseName,
  activeExerciseId,
  metric,
  onMetric,
  expanded,
  onToggle,
  data,
  goal,
  currentBest1rm,
  goalInput,
  onGoalInput,
  onSaveGoal,
  onClearGoal,
}: ProgressionSectionProps) {
  const { t } = useTranslation();
  const { format: formatKg, toDisplay, unit } = useWeight();

  if (exercises.length === 0) return null;

  const metricLabel = (m: Metric) =>
    m === '1rm' ? '1RM' : m === 'maxWeight' ? t('stats.max_weight') : t('stats.volume_short');

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.26 }}
      className="rounded-card p-4 bg-surface"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4"
            fill="none"
            stroke="var(--interactive-primary)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4v6a6 6 0 0 0 12 0V4" />
            <line x1="4" y1="20" x2="20" y2="20" />
          </svg>
          <span className="text-sm font-semibold text-fg">{t('stats.progression_short')}</span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex items-center gap-1 text-xs text-fg-subtle"
        >
          <span>{expanded ? t('common.hide') : t('common.show')}</span>
          <ChevronDown
            className="w-4 h-4 transition-transform"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
          />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3">
          <select
            value={selectedExercise}
            onChange={(e) => onSelectExercise(e.target.value)}
            aria-label={t('stats.progression_short')}
            className="w-full rounded-md text-sm p-3 bg-surface-2 border border-line-strong text-fg"
          >
            {exercises.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>

          <div className="flex gap-1">
            {METRICS.map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => onMetric(m)}
                aria-pressed={metric === m}
                className={`flex-1 text-xs py-2 rounded-md transition-colors font-medium ${
                  metric === m ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-subtle'
                }`}
              >
                {metricLabel(m)}
              </button>
            ))}
          </div>

          <Suspense fallback={<div className="h-56 skeleton rounded-card" aria-hidden="true" />}>
            <ProgressionChart data={data} metric={metric} exerciseName={activeExerciseName} />
          </Suspense>

          {data.length >= 2 && (
            <div className="pt-2 flex items-center justify-between text-xs border-t border-line">
              <span className="text-fg-subtle">{t('stats.best_record')}</span>
              <span className="font-semibold text-accent">
                {formatKg(data[data.length - 1]?.value ?? 0)}
              </span>
            </div>
          )}

          {activeExerciseId && (
            <div className="pt-3 border-t border-line">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-fg">{t('stats.goal_1rm')}</span>
                {goal != null && (
                  <span className="text-2xs font-mono tabular-nums text-fg-subtle">
                    {Math.round(toDisplay(currentBest1rm))} / {formatKg(goal, 0)}
                  </span>
                )}
              </div>
              {goal != null ? (
                <>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round((currentBest1rm / goal) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-2xs text-fg-subtle">
                      {currentBest1rm >= goal
                        ? t('stats.goal_reached')
                        : t('stats.goal_remaining', { amount: formatKg(goal - currentBest1rm) })}
                    </span>
                    <button
                      type="button"
                      onClick={onClearGoal}
                      className="text-2xs text-fg-subtle underline"
                    >
                      {t('common.remove')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={goalInput}
                    onChange={(e) => onGoalInput(e.target.value.replace(/[^\d.,]/g, ''))}
                    aria-label={t('stats.goal_1rm')}
                    placeholder={`${t('stats.goal_placeholder')} ${Math.round(toDisplay(currentBest1rm)) + 5} ${unit}`}
                    className="flex-1 rounded-card text-sm px-3 py-2 outline-none bg-surface-2 border border-line text-fg"
                  />
                  <button
                    type="button"
                    onClick={onSaveGoal}
                    disabled={!goalInput}
                    className="px-4 rounded-card text-sm font-semibold bg-accent text-accent-fg disabled:opacity-50"
                  >
                    {t('stats.goal_set')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </m.div>
  );
}
