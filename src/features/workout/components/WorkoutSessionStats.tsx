import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { useVisibilityPausedInterval } from '@shared/hooks/useVisibilityPausedInterval';

interface WorkoutSessionStatsProps {
  startedAt: string | null;
  totalVolume: number;
  totalSets: number;
  onCancel?: () => void;
}

/**
 * Franja de sesión activa de la referencia visual (`public/screens/workout.png`):
 * punto + cronómetro a la izquierda, acción en píldora perfilada a la derecha.
 * Sin tarjeta: el rediseño la quiere plana sobre el lienzo.
 *
 * La píldora de la maqueta pone "REANUDAR", pero aquí la acción real de la
 * sesión en curso es cancelarla: se copia la forma, no la etiqueta, porque
 * rotular de otro modo un botón destructivo sería engañar. Por lo mismo va en
 * el color de error y no en el acento.
 *
 * Volumen y series no salen en la maqueta y se conservan igualmente (son datos
 * reales de la sesión), en una línea de versalitas apagadas que no compite con
 * el cronómetro.
 */
export function WorkoutSessionStats({
  startedAt,
  totalVolume,
  totalSets,
  onCancel,
}: WorkoutSessionStatsProps) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);

  const update = useCallback(() => {
    if (!startedAt) return;
    setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  }, [startedAt]);

  useVisibilityPausedInterval(update, 1000, !!startedAt);

  if (!startedAt) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const volumeDisplay =
    totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${totalVolume}kg`;

  return (
    <m.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="w-2 h-2 rounded-full bg-accent shadow-glow pulse-soft"
            aria-hidden="true"
          />
          <span className="font-display font-bold tabular text-2xl leading-none text-fg">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
        </div>

        {onCancel && (
          // El área táctil llega a 44 px aunque la píldora se vea más baja,
          // como en la maqueta.
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('workout.cancel_confirm'))) onCancel();
            }}
            title={t('workout.cancel_session')}
            className="-my-2 flex min-h-11 items-center transition-opacity active:opacity-60"
          >
            <span className="label-caps rounded-pill border border-error px-4 py-2 text-error">
              {t('common.cancel')}
            </span>
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-4 label-caps text-fg-subtle">
        <span>
          {t('workout.volume')} <span className="tabular text-fg-muted">{volumeDisplay}</span>
        </span>
        <span>
          {t('workout.sets')} <span className="tabular text-fg-muted">{totalSets}</span>
        </span>
      </div>
    </m.div>
  );
}
