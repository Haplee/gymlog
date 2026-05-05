import { useEffect, useState, useCallback, useRef } from 'react';
import { useRestTimerStore } from '../stores/restTimerStore';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { Plus, Minus, TimerReset } from 'lucide-react';

const PRESETS = [60, 90, 120, 180];
const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}min`;
}

function playCompletionSound() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [0, 160, 320].forEach((delay, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 660 + i * 220;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.45);
      }, delay);
    });
  } catch {
    // ignore
  }
}

export function RestTimer() {
  const { endTime, duration, isRunning, start, stop, remaining } = useRestTimerStore();
  const [display, setDisplay] = useState(() => remaining());
  const [customSecs, setCustomSecs] = useState<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!isRunning || !endTime) {
      setDisplay(0);
      completedRef.current = false;
      return;
    }

    completedRef.current = false;

    const tick = () => {
      const r = remaining();
      setDisplay(r);
      if (r <= 0 && !completedRef.current) {
        completedRef.current = true;
        stop();
        void impact(ImpactStyle.Heavy);
        playCompletionSound();
      }
    };

    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, endTime]);

  const mins = Math.floor(display / 60);
  const secs = display % 60;
  const pct = duration > 0 ? Math.max(0, display / duration) : 0;
  const strokeOffset = CIRCUMFERENCE * (1 - pct);
  const urgent = display <= 10 && display > 0;
  const selectedDuration = customSecs ?? duration;

  const handleStart = useCallback(
    (s: number) => {
      start(s);
      setCustomSecs(null);
      void impact(ImpactStyle.Light);
    },
    [start],
  );

  const adjustCustom = (delta: number) => {
    setCustomSecs(Math.max(10, (customSecs ?? duration) + delta));
  };

  return (
    <div
      className="rounded-[var(--radius-lg)] p-4 mt-3"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="text-[0.75rem] font-semibold uppercase mb-3 flex items-center gap-1.5"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <TimerReset className="w-3.5 h-3.5" />
        Descanso
      </div>

      {isRunning ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke="var(--bg-surface-2)"
                strokeWidth="7"
              />
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={urgent ? 'var(--error)' : 'var(--interactive-primary)'}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeOffset}
                style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span
                className="text-2xl font-mono font-bold tabular-nums leading-none"
                style={{ color: urgent ? 'var(--error)' : 'var(--text-primary)' }}
              >
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
              <span className="text-[0.6rem] uppercase" style={{ color: 'var(--text-tertiary)' }}>
                restante
              </span>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <button
              onClick={() => handleStart(duration)}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{
                backgroundColor: 'var(--bg-surface-2)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              Reiniciar
            </button>
            <button
              onClick={stop}
              className="text-xs underline"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map((s) => (
              <button
                key={s}
                onClick={() => handleStart(s)}
                className="py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor:
                    s === selectedDuration && !customSecs
                      ? 'var(--interactive-primary)'
                      : 'var(--bg-surface-2)',
                  color:
                    s === selectedDuration && !customSecs
                      ? 'var(--interactive-primary-fg)'
                      : 'var(--text-secondary)',
                }}
              >
                {s < 60 ? `${s}s` : `${s / 60}m`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustCustom(-15)}
              className="p-1.5 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleStart(selectedDuration)}
              className="flex-1 py-1.5 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: customSecs ? 'var(--interactive-primary)' : 'var(--bg-surface-2)',
                color: customSecs ? 'var(--interactive-primary-fg)' : 'var(--text-tertiary)',
                border: customSecs ? 'none' : '1px dashed var(--border-subtle)',
              }}
            >
              {formatDuration(selectedDuration)}
            </button>
            <button
              onClick={() => adjustCustom(15)}
              className="p-1.5 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
