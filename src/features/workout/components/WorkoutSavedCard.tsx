import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { IconChart, IconCheckBadge, IconDumbbell, IconTimer, X } from '@shared/components/icons';

export interface WorkoutSummary {
  /** Duración de la sesión en minutos. */
  minutes: number;
  /** Volumen total ya formateado y con unidad (la página conoce kg/lb). */
  volume: string;
  sets: number;
  /** Texto del PR conseguido, si lo hubo. */
  prLabel?: string;
}

interface WorkoutSavedCardProps {
  summary: WorkoutSummary;
  onDismiss: () => void;
}

/**
 * Resumen de la sesión recién guardada, en la propia pantalla de Inicio.
 * No bloquea: quien encadena entrenos sigue a lo suyo y la descarta cuando
 * quiere. Sustituye al modal de felicitación.
 */
export function WorkoutSavedCard({ summary, onDismiss }: WorkoutSavedCardProps) {
  const { t } = useTranslation();

  const stats = [
    { Icon: IconTimer, value: t('workout.complete_minutes', { count: summary.minutes }) },
    { Icon: IconDumbbell, value: summary.volume },
    { Icon: IconChart, value: t('workout.complete_sets', { count: summary.sets }) },
  ];

  return (
    <m.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="mb-3 rounded-card bg-accent p-3.5 shadow-fab"
    >
      <div className="flex items-start gap-2.5">
        <IconCheckBadge className="h-5 w-5 flex-shrink-0 text-accent-fg" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm font-bold text-accent-fg">
            {t('workout.complete_title')}
          </h2>
          {summary.prLabel && (
            <p className="mt-0.5 text-xs font-medium text-accent-fg/85">{summary.prLabel}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('common.close')}
          className="-m-1.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-accent-fg/85 active:text-accent-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 rounded-pill bg-surface px-4 py-2">
        {stats.map(({ Icon, value }) => (
          <span key={value} className="flex items-center gap-1.5 text-xs text-fg-muted">
            <Icon className="h-3.5 w-3.5 text-accent" />
            <span className="font-display tabular font-semibold text-fg">{value}</span>
          </span>
        ))}
      </div>
    </m.section>
  );
}
