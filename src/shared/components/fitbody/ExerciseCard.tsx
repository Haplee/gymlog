import { memo } from 'react';
import { Play } from 'lucide-react';

interface ExerciseCardProps {
  /** Nombre del ejercicio */
  name: string;
  /** Duración/tiempo, p.ej. "00:30" */
  duration?: string;
  /** Repeticiones/series, p.ej. "3x" */
  reps?: string;
  onPlay?: () => void;
  /** aria-label del botón play (obligatorio para accesibilidad si hay onPlay) */
  playLabel: string;
  className?: string;
}

/**
 * Fila de ejercicio estilo FitBody: botón play circular de acento + nombre y
 * meta (duración) + repeticiones. Componente nuevo del reskin.
 */
const ExerciseCardComponent = ({
  name,
  duration,
  reps,
  onPlay,
  playLabel,
  className = '',
}: ExerciseCardProps) => {
  return (
    <div
      className={`flex items-center gap-3 rounded-card border border-line bg-surface p-3 ${className}`}
    >
      <button
        type="button"
        onClick={onPlay}
        aria-label={playLabel}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg shadow-btn-accent transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Play className="h-5 w-5 fill-current" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-fg">{name}</p>
        {duration && <p className="text-xs text-fg-subtle tabular">{duration}</p>}
      </div>
      {reps && <span className="shrink-0 label-caps text-accent tabular">{reps}</span>}
    </div>
  );
};

export const ExerciseCard = memo(ExerciseCardComponent);
