import { useEffect, useState, useCallback, useRef } from 'react';
import { useRestTimerStore } from '../stores/restTimerStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { Plus, Minus, TimerReset } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PRESETS = [60, 90, 120, 180];
const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function playCompletionSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    // Three sharp beeps: 880Hz square wave, loud
    [0, 200, 400].forEach((delay) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'square';
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      }, delay);
    });
  } catch {
    // ignore
  }
}

export function RestTimer() {
  const { endTime, duration, isRunning, start, stop, extend, remaining } = useRestTimerStore();
  const { restAutoStart, setRestAutoStart } = useSettingsStore();
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
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, endTime]);

  const mins = Math.floor(display / 60);
  const secs = display % 60;
  const pct = duration > 0 ? Math.max(0, display / duration) : 0;
  const strokeOffset = CIRCUMFERENCE * (1 - pct);
  const urgent = display <= 10 && display > 0;
  const selectedDuration = customSecs ?? duration;

  const accentColor = urgent ? 'var(--error)' : 'var(--interactive-primary)';

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
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="text-[0.7rem] font-semibold uppercase flex items-center gap-1.5 tracking-widest"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <TimerReset className="w-3.5 h-3.5" />
          Descanso
        </div>
        <button
          onClick={() => {
            setRestAutoStart(!restAutoStart);
            void impact(ImpactStyle.Light);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-pill)] text-[0.625rem] font-bold uppercase tracking-wider transition-colors"
          style={{
            backgroundColor: restAutoStart ? 'rgba(200,255,0,0.12)' : 'var(--bg-surface-2)',
            color: restAutoStart ? 'var(--interactive-primary)' : 'var(--text-tertiary)',
            border: restAutoStart
              ? '1px solid rgba(200,255,0,0.25)'
              : '1px solid var(--border-subtle)',
          }}
          aria-pressed={restAutoStart}
          title={restAutoStart ? 'Auto activado' : 'Auto desactivado'}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: restAutoStart
                ? 'var(--interactive-primary)'
                : 'var(--text-tertiary)',
            }}
          />
          Auto {restAutoStart ? 'on' : 'off'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {isRunning ? (
          <motion.div
            key="running"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="flex flex-col items-center gap-4"
          >
            {/* Circle timer — wrapper 200×200, radio reducido para espacio interior */}
            <div
              className="relative flex items-center justify-center"
              style={{ width: 200, height: 200 }}
            >
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  transform: 'rotate(-90deg)',
                  overflow: 'visible',
                }}
                viewBox="0 0 100 100"
              >
                {/* Anillo de fondo tenue */}
                <circle
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  fill="none"
                  stroke="var(--bg-surface-3)"
                  strokeWidth="4"
                />
                {/* Arco de progreso */}
                <circle
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={strokeOffset}
                  style={{
                    transition: 'stroke-dashoffset 0.35s linear, stroke 0.4s ease',
                    filter: `drop-shadow(0 0 8px ${accentColor}99)`,
                  }}
                />
              </svg>

              {/* Centro — completamente separado del SVG, apilado encima */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <motion.span
                  key={urgent ? 'urgent' : 'normal'}
                  initial={{ scale: 1.06 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="font-mono font-bold tabular-nums leading-none"
                  style={{
                    fontSize: '1.875rem',
                    color: urgent ? 'var(--error)' : 'var(--text-primary)',
                    letterSpacing: '-0.04em',
                  }}
                >
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </motion.span>
                <span
                  className="text-[0.5rem] font-bold uppercase tracking-[0.22em]"
                  style={{
                    color: urgent ? 'var(--error)' : 'var(--text-tertiary)',
                    opacity: 0.7,
                  }}
                >
                  restante
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 w-full justify-center">
              <button
                onClick={() => {
                  void impact(ImpactStyle.Light);
                  extend(30);
                }}
                className="px-3 py-2 rounded-[var(--radius-pill)] text-xs font-bold"
                style={{
                  backgroundColor: 'rgba(200,255,0,0.1)',
                  color: 'var(--interactive-primary)',
                  border: '1px solid rgba(200,255,0,0.2)',
                }}
              >
                +30s
              </button>
              <button
                onClick={() => handleStart(duration)}
                className="px-4 py-2 rounded-[var(--radius-pill)] text-xs font-semibold tracking-wide"
                style={{
                  backgroundColor: 'var(--bg-surface-2)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-default)',
                }}
              >
                Reiniciar
              </button>
              <button
                onClick={stop}
                className="px-3 py-2 rounded-[var(--radius-pill)] text-xs"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {/* Presets — siempre en segundos */}
            <div className="grid grid-cols-4 gap-1.5">
              {PRESETS.map((s) => {
                const active = s === selectedDuration && !customSecs;
                return (
                  <button
                    key={s}
                    onClick={() => handleStart(s)}
                    className="py-2.5 rounded-[var(--radius-pill)] text-[0.8125rem] font-bold transition-all active:scale-95"
                    style={{
                      backgroundColor: active
                        ? 'var(--interactive-primary)'
                        : 'var(--bg-surface-2)',
                      color: active ? 'var(--interactive-primary-fg)' : 'var(--text-secondary)',
                      boxShadow: active ? 'var(--glow-accent)' : 'none',
                      border: active ? 'none' : '1px solid var(--border-subtle)',
                    }}
                  >
                    {`${s}s`}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => adjustCustom(-15)}
                className="w-9 h-9 rounded-[var(--radius-pill)] flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: 'var(--bg-surface-2)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleStart(selectedDuration)}
                className="flex-1 h-9 rounded-[var(--radius-pill)] text-sm font-bold transition-all active:scale-95"
                style={
                  customSecs
                    ? {
                        backgroundColor: 'var(--interactive-primary)',
                        color: 'var(--interactive-primary-fg)',
                        boxShadow: 'var(--glow-accent)',
                      }
                    : {
                        backgroundColor: 'var(--bg-surface-2)',
                        color: 'var(--text-tertiary)',
                        border: '1px dashed var(--border-default)',
                      }
                }
              >
                {`${selectedDuration}s`}
              </button>
              <button
                onClick={() => adjustCustom(15)}
                className="w-9 h-9 rounded-[var(--radius-pill)] flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: 'var(--bg-surface-2)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
