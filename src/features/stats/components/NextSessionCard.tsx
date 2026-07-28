import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import type { ExerciseAdvice } from '../hooks/useAutoregulation';

const ACTION_ICON = {
  increase: TrendingUp,
  reduce: TrendingDown,
  hold: Minus,
} as const;

/**
 * Sugerencia de carga para la próxima sesión de un ejercicio.
 *
 * Sale del motor determinista: no necesita el entrenador IA ni conexión.
 */
export function NextSessionCard({ advice }: { advice: ExerciseAdvice }) {
  const { t } = useTranslation();
  const { exercise, suggestion, stall } = advice;
  const Icon = ACTION_ICON[suggestion.action];

  const tone =
    suggestion.action === 'increase'
      ? 'text-accent'
      : suggestion.action === 'reduce'
        ? 'text-warning'
        : 'text-fg-muted';

  return (
    <article className="rounded-card bg-surface border border-line p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-fg">{exercise}</h3>
          <p className={`flex items-center gap-1.5 text-xs ${tone}`}>
            <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            {t(`coach.action.${suggestion.action}`)}
          </p>
        </div>
        <span className="flex-shrink-0 font-display text-base font-bold tabular text-fg">
          {t('coach.from_to', {
            from: suggestion.baseWeight,
            fromReps: suggestion.reps,
            to: suggestion.weight,
            toReps: suggestion.reps,
          })}
        </span>
      </header>

      <p className="mt-2 text-xs text-fg-muted">{t(suggestion.reasonKey)}</p>

      {stall?.stalled && (
        <p className="mt-2 flex gap-1.5 rounded-sm bg-surface-2 p-2 text-xs text-fg-muted">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-warning" aria-hidden="true" />
          <span>{t(`coach.stall.cause_${stall.causeKey}`)}</span>
        </p>
      )}
    </article>
  );
}
