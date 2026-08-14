import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@shared/components/ui';
import { calcularDiscos, COMMON_PLATES_KG, DEFAULT_BAR_KG } from '@shared/lib/plates';
import { useSettingsStore } from '@shared/stores/settingsStore';

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
  const [editandoDiscos, setEditandoDiscos] = useState(false);
  const availablePlates = useSettingsStore((s) => s.availablePlatesKg);
  const setAvailablePlates = useSettingsStore((s) => s.setAvailablePlatesKg);

  const result = useMemo(() => {
    const targetNum = parseFloat(target.replace(',', '.'));
    if (!Number.isFinite(targetNum)) return null;
    return calcularDiscos(targetNum, bar, availablePlates);
  }, [target, bar, availablePlates]);

  const alternarDisco = (peso: number) => {
    const activo = availablePlates.includes(peso);
    setAvailablePlates(
      activo ? availablePlates.filter((p) => p !== peso) : [...availablePlates, peso],
    );
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('workout.plates_calc')}>
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
        className="w-full mt-1 mb-3 rounded-card text-base px-3 py-2.5 outline-none text-center text-fg bg-surface-2 border border-line-strong"
      />

      <div className="text-2xs uppercase font-semibold mb-1.5 text-fg-subtle">
        {t('workout.plates_bar')} (kg)
      </div>
      <div className="flex gap-1.5 mb-4">
        {BAR_OPTIONS.map((b) => (
          <button
            type="button"
            key={b}
            onClick={() => setBar(b)}
            aria-pressed={bar === b}
            className="flex-1 min-h-11 rounded-card text-sm font-medium border"
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

      <div className="rounded-md p-3 bg-surface-2 border border-line">
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-sm bg-surface border border-line-strong"
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

      {/* Discos del gimnasio. Plegado por defecto: se configura una vez y se
          olvida, así que no debe competir con el resultado, que es lo que se
          mira cada vez. */}
      <button
        type="button"
        onClick={() => setEditandoDiscos((v) => !v)}
        aria-expanded={editandoDiscos}
        className="mt-3 flex w-full items-center justify-between gap-2 rounded-md border border-line px-3 min-h-11 text-2xs uppercase font-semibold text-fg-subtle"
      >
        <span>{t('workout.plates_available')}</span>
        <span className="font-mono normal-case text-fg-muted">
          {availablePlates.length > 0
            ? `${[...availablePlates].sort((a, b) => b - a).join(' · ')} kg`
            : t('workout.plates_available_none')}
        </span>
      </button>

      {editandoDiscos && (
        <div className="mt-2 rounded-md border border-line p-3">
          <div className="text-2xs text-fg-subtle mb-2">{t('workout.plates_available_help')}</div>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_PLATES_KG.map((peso) => {
              const activo = availablePlates.includes(peso);
              return (
                <button
                  key={peso}
                  type="button"
                  onClick={() => alternarDisco(peso)}
                  aria-pressed={activo}
                  className={`min-h-11 min-w-14 rounded-pill border px-3 font-mono text-sm font-semibold ${
                    activo
                      ? 'bg-accent border-accent text-accent-fg'
                      : 'bg-surface-2 border-line-interactive text-fg-muted'
                  }`}
                >
                  {peso}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
