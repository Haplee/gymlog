import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { Trophy, Clock, Dumbbell, Layers } from 'lucide-react';

export interface WorkoutSummary {
  /** Duración de la sesión en minutos. */
  minutes: number;
  /** Volumen total ya formateado y con unidad (la página conoce kg/lb). */
  volume: string;
  sets: number;
  /** Texto del PR conseguido, si lo hubo. */
  prLabel?: string;
}

interface WorkoutCompleteModalProps {
  summary: WorkoutSummary;
  onClose: () => void;
  onGoHistory: () => void;
}

/**
 * Pantalla de entreno completado del kit FitBody ("Congratulations!"): trofeo
 * sobre el fondo base, banda rellena de acento con el titular y una píldora
 * clara con los tres datos de la sesión, y dos botones apilados.
 */
export function WorkoutCompleteModal({ summary, onClose, onGoHistory }: WorkoutCompleteModalProps) {
  const { t } = useTranslation();

  const stats = [
    { Icon: Clock, value: t('workout.complete_minutes', { count: summary.minutes }) },
    { Icon: Dumbbell, value: summary.volume },
    { Icon: Layers, value: t('workout.complete_sets', { count: summary.sets }) },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('workout.complete_title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 p-4"
    >
      <m.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="w-full max-w-sm overflow-hidden rounded-card bg-surface shadow-fab"
      >
        <div className="flex flex-col items-center px-6 pb-6 pt-8">
          <m.span
            initial={{ scale: 0.6, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.08 }}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/12"
          >
            <Trophy className="h-10 w-10 text-accent" />
          </m.span>
        </div>

        {/* Banda de acento con el titular y la píldora de datos */}
        <div className="bg-accent px-5 py-5 text-center">
          <h2 className="font-display text-xl font-bold text-accent-fg">
            {t('workout.complete_title')}
          </h2>
          {summary.prLabel && (
            <p className="mt-1 text-sm font-medium text-accent-fg/80">{summary.prLabel}</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2 rounded-pill bg-surface px-4 py-2.5">
            {stats.map(({ Icon, value }) => (
              <span key={value} className="flex items-center gap-1.5 text-xs text-fg-muted">
                <Icon className="h-3.5 w-3.5 text-accent" />
                <span className="font-display tabular font-semibold text-fg">{value}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 p-5">
          <button
            type="button"
            onClick={onGoHistory}
            className="min-h-11 rounded-pill bg-accent px-6 font-semibold text-accent-fg active:scale-[0.98] transition-transform"
          >
            {t('workout.complete_see_history')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-pill bg-surface-2 px-6 font-medium text-fg active:scale-[0.98] transition-transform"
          >
            {t('workout.complete_keep_training')}
          </button>
        </div>
      </m.div>
    </div>
  );
}
