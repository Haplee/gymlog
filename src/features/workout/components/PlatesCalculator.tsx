import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@shared/components/ui';
import { calcularDiscos, DEFAULT_BAR_KG } from '@shared/lib/plates';

interface PlatesCalculatorProps {
  open: boolean;
  /** Peso inicial sugerido en kg (p. ej. la mejor serie de la sesión). */
  initialTargetKg?: number;
  onClose: () => void;
}

const BAR_OPTIONS = [DEFAULT_BAR_KG, 15, 10, 7] as const;

/**
 * Calculadora de discos. Opera en kg (discos olímpicos estándar), con
 * independencia de la unidad de visualización de la app.
 *
 * El estado se siembra desde `initialTargetKg` vía `useState`; el padre debe
 * remontar el componente (prop `key`) al abrir para refrescar la sugerencia.
 */
export function PlatesCalculator({ open, initialTargetKg, onClose }: PlatesCalculatorProps) {
  const { t } = useTranslation();
  const [target, setTarget] = useState(
    initialTargetKg && initialTargetKg > 0 ? String(Math.round(initialTargetKg)) : '',
  );
  const [bar, setBar] = useState<number>(DEFAULT_BAR_KG);

  const result = useMemo(() => {
    const targetNum = parseFloat(target.replace(',', '.'));
    if (!Number.isFinite(targetNum)) return null;
    return calcularDiscos(targetNum, bar);
  }, [target, bar]);

  return (
    <Modal open={open} onClose={onClose} title={t('workout.plates_calc')}>
      <label className="text-2xs uppercase font-semibold text-fg-subtle">
        {t('workout.plates_target')} (kg)
      </label>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.,]?[0-9]*"
        placeholder="100"
        value={target}
        onChange={(e) => setTarget(e.target.value.replace(/[^\d.,]/g, ''))}
        className="w-full mt-1 mb-3 rounded-lg text-base px-3 py-2.5 outline-none text-center text-fg bg-surface-2 border border-line-strong"
      />

      <div className="text-2xs uppercase font-semibold mb-1.5 text-fg-subtle">
        {t('workout.plates_bar')} (kg)
      </div>
      <div className="flex gap-1.5 mb-4">
        {BAR_OPTIONS.map((b) => (
          <button
            key={b}
            onClick={() => setBar(b)}
            aria-pressed={bar === b}
            className="flex-1 min-h-11 rounded-lg text-sm font-medium border"
            style={{
              backgroundColor: bar === b ? 'var(--interactive-primary)' : 'var(--bg-surface-2)',
              color: bar === b ? 'var(--interactive-primary-fg)' : 'var(--text-secondary)',
              borderColor: bar === b ? 'var(--interactive-primary)' : 'var(--border-subtle)',
            }}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="rounded-xl p-3 bg-surface-2 border border-line">
        <div className="text-2xs uppercase font-semibold mb-2 text-fg-subtle">
          {t('workout.plates_each_side')}
        </div>
        {!result || result.perSide.length === 0 ? (
          <div className="text-sm text-center py-3 text-fg-subtle">{t('workout.plates_empty')}</div>
        ) : (
          <div className="flex flex-wrap gap-2 justify-center">
            {result.perSide.map((p) => (
              <div
                key={p.weight}
                className="flex items-center gap-1.5 px-3 py-2 rounded-pill bg-surface border border-line-strong"
              >
                <span className="font-mono text-base font-bold text-accent">{p.weight}</span>
                <span className="text-xs text-fg-muted">× {p.count}</span>
              </div>
            ))}
          </div>
        )}
        {result && result.leftoverPerSide > 0 && (
          <div className="text-2xs mt-2 text-center text-warning">
            {t('workout.plates_leftover', { kg: result.leftoverPerSide })}
          </div>
        )}
        {result && result.perSide.length > 0 && (
          <div className="text-2xs mt-2 text-center text-fg-subtle">
            = {result.totalAchievable} kg
          </div>
        )}
      </div>
    </Modal>
  );
}
