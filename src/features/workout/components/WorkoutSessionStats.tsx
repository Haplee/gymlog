import { useEffect, useState } from 'react';
import { Clock, Zap, Layers, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

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
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-0 mb-3 rounded-[var(--radius-lg)] overflow-hidden"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
        WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--glass-shadow)',
      }}
    >
      <div className="flex-1 flex flex-col items-center py-2.5 gap-0.5">
        <Clock className="w-3.5 h-3.5 mb-0.5" style={{ color: 'var(--interactive-primary)' }} />
        <span
          className="font-mono text-sm font-bold tabular-nums"
          style={{ color: 'var(--text-primary)' }}
        >
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
        <span className="text-[0.6rem] uppercase" style={{ color: 'var(--text-tertiary)' }}>
          Tiempo
        </span>
      </div>

      <div className="w-px self-stretch" style={{ backgroundColor: 'var(--border-subtle)' }} />

      <div className="flex-1 flex flex-col items-center py-2.5 gap-0.5">
        <Zap className="w-3.5 h-3.5 mb-0.5" style={{ color: 'var(--text-tertiary)' }} />
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {volumeDisplay}
        </span>
        <span className="text-[0.6rem] uppercase" style={{ color: 'var(--text-tertiary)' }}>
          Volumen
        </span>
      </div>

      <div className="w-px self-stretch" style={{ backgroundColor: 'var(--border-subtle)' }} />

      <div className="flex-1 flex flex-col items-center py-2.5 gap-0.5">
        <Layers className="w-3.5 h-3.5 mb-0.5" style={{ color: 'var(--text-tertiary)' }} />
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {totalSets}
        </span>
        <span className="text-[0.6rem] uppercase" style={{ color: 'var(--text-tertiary)' }}>
          Series
        </span>
      </div>

      {onCancel && (
        <>
          <div className="w-px self-stretch" style={{ backgroundColor: 'var(--border-subtle)' }} />
          <button
            onClick={() => {
              if (window.confirm('¿Cancelar y eliminar la sesión de entrenamiento actual?')) {
                onCancel();
              }
            }}
            className="px-3 flex flex-col items-center justify-center transition-colors hover:opacity-70 active:opacity-50"
            title="Cancelar entrenamiento"
          >
            <XCircle className="w-4 h-4 mb-0.5" style={{ color: 'var(--error)' }} />
            <span className="text-[0.6rem] uppercase font-bold" style={{ color: 'var(--error)' }}>
              Cancelar
            </span>
          </button>
        </>
      )}
    </motion.div>
  );
}
