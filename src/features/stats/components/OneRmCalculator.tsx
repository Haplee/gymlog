import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { calcular1RM, es1RMFiable, REPS_MAX_FIABLE_1RM } from '@shared/lib/brzycki';
import { useWeight } from '@shared/hooks/useWeight';
import { Calculator } from '@shared/components/icons';

/**
 * Calculadora de 1RM estimado (Brzycki, `@shared/lib/brzycki`).
 *
 * Estaba incrustada al final de `StatsPage` con tres estados propios que nadie
 * más miraba; sacarla se lleva ese estado con ella y deja la página por debajo
 * del límite de 800 líneas de CLAUDE.md.
 *
 * Los kg se introducen en la unidad del usuario y se convierten a kg para el
 * cálculo, porque la fórmula no es lineal respecto a la unidad.
 */
export function OneRmCalculator() {
  const { t } = useTranslation();
  const { unit, toKg, toDisplay } = useWeight();
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [result, setResult] = useState<number | null>(null);
  /** La estimación sale igual, pero por encima del límite se avisa de que no es fiable. */
  const [fiable, setFiable] = useState(true);

  const recalc = (w: string, r: string) => {
    const weightNum = parseFloat(w);
    const repsNum = parseInt(r, 10);
    if (!Number.isFinite(weightNum) || !Number.isFinite(repsNum) || repsNum <= 0) {
      setResult(null);
      setFiable(true);
      return;
    }
    setResult(toDisplay(calcular1RM(toKg(weightNum), repsNum)));
    setFiable(es1RMFiable(repsNum));
  };

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="rounded-card p-4 bg-surface"
    >
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-4 h-4 text-accent" />
        <span className="text-base font-semibold text-fg">{t('stats.rm_calculator')}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs mb-1.5 text-fg-subtle">
            {t('stats.weight_label')} ({unit})
          </div>
          <input
            type="number"
            placeholder="100"
            aria-label={`${t('stats.weight_label')} (${unit})`}
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value);
              recalc(e.target.value, reps);
            }}
            className="w-full rounded-md text-base p-3 outline-none bg-surface-2 border border-line-strong text-fg"
          />
        </div>
        <div>
          <div className="text-xs mb-1.5 text-fg-subtle">{t('stats.reps')}</div>
          <input
            type="number"
            placeholder="10"
            aria-label={t('stats.reps')}
            value={reps}
            onChange={(e) => {
              setReps(e.target.value);
              recalc(weight, e.target.value);
            }}
            className="w-full rounded-md text-base p-3 outline-none bg-surface-2 border border-line-strong text-fg"
          />
        </div>
      </div>
      <div className="mt-4 text-center">
        <div className="text-xs mb-1 text-fg-subtle">{t('stats.estimated_1rm')}</div>
        <div className="text-3xl font-bold font-mono text-accent tabular-nums">
          {result ? `${result.toFixed(1)} ${unit}` : '—'}
        </div>
        {result !== null && !fiable && (
          <p className="mt-2 text-xs text-fg-muted">
            {t('stats.rm_unreliable', { reps: REPS_MAX_FIABLE_1RM })}
          </p>
        )}
      </div>
    </m.div>
  );
}
