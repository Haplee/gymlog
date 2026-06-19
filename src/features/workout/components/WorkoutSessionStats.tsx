import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XCircle } from 'lucide-react';
import { m } from 'framer-motion';

interface WorkoutSessionStatsProps {
  startedAt: string | null;
  totalVolume: number;
  totalSets: number;
  onCancel?: () => void;
}

/**
 * Scoreboard de la sesión activa: el cronómetro (Geist Mono) es el héroe; volumen
 * y series lo acompañan como marcador. Un punto "rec" indica sesión en curso.
 */
export function WorkoutSessionStats({
  startedAt,
  totalVolume,
  totalSets,
  onCancel,
}: WorkoutSessionStatsProps) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const update = () =>
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const volumeDisplay =
    totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${totalVolume}kg`;

  return (
    <m.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 rounded-2xl px-4 py-3.5 bg-surface border border-line shadow-card"
    >
      {/* Eyebrow + indicador rec + cancelar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full bg-accent shadow-glow pulse-soft"
            aria-hidden="true"
          />
          <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-fg-subtle">
            {t('workout.active_session')}
          </span>
        </div>
        {onCancel && (
          <button
            onClick={() => {
              if (window.confirm(t('workout.cancel_confirm'))) onCancel();
            }}
            className="flex items-center gap-1 min-h-9 px-2 -mr-2 rounded-lg text-error transition-opacity active:opacity-50"
            title={t('workout.cancel_session')}
          >
            <XCircle className="w-4 h-4" />
            <span className="text-2xs font-semibold uppercase">{t('common.cancel')}</span>
          </button>
        )}
      </div>

      {/* Héroe: cronómetro mono */}
      <div className="mt-1.5 font-mono font-bold tabular-nums leading-none tracking-tight text-fg text-[2.75rem]">
        {String(mins).padStart(2, '0')}
        <span className="text-fg-subtle">:</span>
        {String(secs).padStart(2, '0')}
      </div>

      {/* Marcador: volumen · series */}
      <div className="mt-2.5 flex items-center gap-5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono font-bold tabular-nums text-base text-fg">
            {volumeDisplay}
          </span>
          <span className="text-2xs uppercase tracking-wide text-fg-subtle">
            {t('workout.volume')}
          </span>
        </div>
        <span className="w-px h-3.5 bg-line" aria-hidden="true" />
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono font-bold tabular-nums text-base text-fg">{totalSets}</span>
          <span className="text-2xs uppercase tracking-wide text-fg-subtle">
            {t('workout.sets')}
          </span>
        </div>
      </div>
    </m.div>
  );
}
