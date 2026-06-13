import { useEffect, useState } from 'react';
import { Clock, Zap, Layers, XCircle } from 'lucide-react';
import { m } from 'framer-motion';

interface WorkoutSessionStatsProps {
  startedAt: string | null;
  totalVolume: number;
  totalSets: number;
  onCancel?: () => void;
}

export function WorkoutSessionStats({
  startedAt,
  totalVolume,
  totalSets,
  onCancel,
}: WorkoutSessionStatsProps) {
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
      className="flex items-center gap-0 mb-3 rounded-2xl overflow-hidden bg-surface border border-line shadow-card"
    >
      <div className="flex-1 flex flex-col items-center py-2.5 gap-0.5">
        <Clock className="w-3.5 h-3.5 mb-0.5 text-accent" />
        <span className="font-mono text-sm font-bold tabular-nums text-fg">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
        <span className="text-2xs uppercase text-fg-subtle">Tiempo</span>
      </div>

      <div className="w-px self-stretch bg-line" />

      <div className="flex-1 flex flex-col items-center py-2.5 gap-0.5">
        <Zap className="w-3.5 h-3.5 mb-0.5 text-fg-subtle" />
        <span className="text-sm font-bold text-fg">{volumeDisplay}</span>
        <span className="text-2xs uppercase text-fg-subtle">Volumen</span>
      </div>

      <div className="w-px self-stretch bg-line" />

      <div className="flex-1 flex flex-col items-center py-2.5 gap-0.5">
        <Layers className="w-3.5 h-3.5 mb-0.5 text-fg-subtle" />
        <span className="text-sm font-bold text-fg">{totalSets}</span>
        <span className="text-2xs uppercase text-fg-subtle">Series</span>
      </div>

      {onCancel && (
        <>
          <div className="w-px self-stretch bg-line" />
          <button
            onClick={() => {
              if (window.confirm('¿Cancelar y eliminar la sesión de entrenamiento actual?')) {
                onCancel();
              }
            }}
            className="px-3 flex flex-col items-center justify-center transition-colors hover:opacity-70 active:opacity-50"
            title="Cancelar entrenamiento"
          >
            <XCircle className="w-4 h-4 mb-0.5 text-error" />
            <span className="text-2xs uppercase font-bold text-error">Cancelar</span>
          </button>
        </>
      )}
    </m.div>
  );
}
