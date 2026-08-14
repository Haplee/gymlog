import { useTranslation } from 'react-i18next';
import type { ExerciseAdvice } from '../hooks/useAutoregulation';
import type { LoadSuggestion } from '../utils/autoregulation';
import { useWeight } from '@shared/hooks/useWeight';
import { formatWeightInput } from '@shared/lib/weight';
import { AlertTriangle, Minus, TrendDown, TrendUp } from '@shared/components/icons';

const ACTION_ICON = {
  increase: TrendUp,
  reduce: TrendDown,
  hold: Minus,
} as const;

/**
 * Sugerencia de carga para la próxima sesión de un ejercicio.
 *
 * Sale del motor determinista: no necesita el entrenador IA ni conexión.
 */
export function NextSessionCard({
  advice,
  onApply,
}: {
  advice: ExerciseAdvice;
  /** Cuando se pasa, la tarjeta ofrece «Aplicar» para precargar el peso. */
  onApply?: (suggestion: LoadSuggestion) => void;
}) {
  const { t } = useTranslation();
  const { unit: weightUnit, convert } = useWeight();
  const { exercise, suggestion, stall } = advice;
  const Icon = ACTION_ICON[suggestion.action];

  const tone =
    suggestion.action === 'increase'
      ? 'text-accent'
      : suggestion.action === 'reduce'
        ? 'text-warning'
        : 'text-fg-muted';

  const weightDisplay = (kg: number) => `${formatWeightInput(convert(kg))} ${weightUnit}`;

  // El delta de carga va coloreado por acción: verde para subir, rojo para
  // bajar, neutro cuando se mantiene.
  const deltaKg = convert(suggestion.weight) - convert(suggestion.baseWeight);
  const deltaLabel =
    suggestion.action === 'hold'
      ? t('coach.delta_hold', { unit: weightUnit })
      : t(suggestion.action === 'increase' ? 'coach.delta_increase' : 'coach.delta_reduce', {
          deltaKg: formatWeightInput(Math.abs(deltaKg)),
          unit: weightUnit,
          deltaPct: Math.abs(suggestion.deltaPct).toFixed(1),
        });
  const deltaTone =
    suggestion.action === 'increase'
      ? 'text-success'
      : suggestion.action === 'reduce'
        ? 'text-error'
        : 'text-fg-muted';

  return (
    <article className="glass-2 rounded-card p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-fg">{exercise}</h3>
          <p className={`flex items-center gap-1.5 text-xs ${tone}`}>
            <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            {t(`coach.action.${suggestion.action}`)}
          </p>
        </div>
      </header>

      {/* De dónde se viene y a dónde se va, con el delta de carga. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {/* El pasado con los datos del pasado: `baseReps`, no las sugeridas. */}
        <span className="label-caps rounded-sm bg-surface-2 px-2 py-1 text-fg-muted">
          {t('coach.last_label')} · {weightDisplay(suggestion.baseWeight)} × {suggestion.baseReps}
        </span>
        <span className="label-caps rounded-sm bg-accent/15 px-2 py-1 text-accent">
          {t('coach.next_label')} · {weightDisplay(suggestion.weight)} × {suggestion.reps}
        </span>
        <span className={`label-caps tabular ${deltaTone}`}>{deltaLabel}</span>
      </div>

      <p className="mt-2 text-xs text-fg-muted">{t(suggestion.reasonKey)}</p>

      {stall?.stalled && (
        <p className="mt-2 flex gap-1.5 rounded-sm bg-surface-2 p-2 text-xs text-fg-muted">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-warning" aria-hidden="true" />
          <span>{t(`coach.stall.cause_${stall.causeKey}`)}</span>
        </p>
      )}

      {onApply && (
        <button
          type="button"
          onClick={() => onApply(suggestion)}
          className="mt-3 w-full min-h-11 rounded-sm bg-accent px-3 text-sm font-semibold text-accent-fg transition-transform active:scale-[0.98]"
        >
          {t('workout.apply')}
        </button>
      )}
    </article>
  );
}
