import { useTranslation } from 'react-i18next';
import type { PersonalRecord } from '@shared/lib/types';
import { Calculator, Trophy } from '@shared/components/icons';

interface WorkoutQuickChipsProps {
  bestEstimate: { weightKg: number; e1rm: number } | null;
  currentPR: PersonalRecord | null;
  currentPRs: PersonalRecord[];
  weightUnit: string;
  convert: (kg: number) => number;
  onOpenPlates: () => void;
}

/**
 * Chips de consulta de la sesión: calculadora de discos, 1RM estimado y récords
 * por banda de reps.
 *
 * Ninguno lleva acento: son información («esto se puede consultar»), no la
 * acción principal, y competían con el ✓ de confirmar serie. La regla del
 * sistema es un acento por pantalla. El récord actual va en `text-fg`, que
 * destaca igual de bien sin pelearse el acento con nada más.
 */
export function WorkoutQuickChips({
  bestEstimate,
  currentPR,
  currentPRs,
  weightUnit,
  convert,
  onOpenPlates,
}: WorkoutQuickChipsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpenPlates}
          className="label-caps flex min-h-11 items-center gap-2 rounded-sm bg-surface-2 px-3 text-fg-muted transition-colors active:bg-hover"
        >
          <Calculator className="h-4 w-4" aria-hidden="true" />
          {t('workout.plates_calc_short')}
        </button>
        {bestEstimate && (
          <span className="label-caps flex min-h-11 items-center gap-2 rounded-sm bg-surface-2 text-fg-muted">
            <Trophy className="h-4 w-4" aria-hidden="true" />
            {t('workout.e1rm')} {convert(bestEstimate.e1rm).toFixed(1)} {weightUnit}
          </span>
        )}
      </div>

      {(currentPR || currentPRs.length > 1) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          {currentPR && (
            <span className="label-caps text-fg">
              {t('workout.recent_pr')} {convert(Number(currentPR.weight)).toFixed(1)} {weightUnit} ×{' '}
              {currentPR.reps}
            </span>
          )}
          {currentPRs.length > 1 &&
            currentPRs.map((pr) => (
              <span
                key={pr.rep_band}
                className="label-caps tabular text-fg-subtle"
                title={t('workout.pr_by_band')}
              >
                {pr.rep_band === 15 ? '15+' : pr.rep_band}r ·{' '}
                {convert(Number(pr.weight)).toFixed(0)}
                {weightUnit}
              </span>
            ))}
        </div>
      )}
    </>
  );
}
