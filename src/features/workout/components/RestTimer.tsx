import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRestTimerStore } from '../stores/restTimerStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { useVisibilityPausedInterval } from '@shared/hooks/useVisibilityPausedInterval';
import { m, AnimatePresence } from 'framer-motion';
import { AlarmClock, Minus, Plus, Timer } from '@shared/components/icons';

const PRESETS = [60, 90, 120, 180];

export function RestTimer() {
  const { t } = useTranslation();
  // Selectores finos: este componente ya se re-renderiza cada segundo por su
  // propio tick, así que no debe hacerlo además por cualquier cambio ajeno de
  // los dos stores (p. ej. cada tecla en las series o cualquier otro ajuste).
  const { endTime, duration, isRunning, start, stop, extend, remaining } = useRestTimerStore(
    useShallow((s) => ({
      endTime: s.endTime,
      duration: s.duration,
      isRunning: s.isRunning,
      start: s.start,
      stop: s.stop,
      extend: s.extend,
      remaining: s.remaining,
    })),
  );
  const restAutoStart = useSettingsStore((s) => s.restAutoStart);
  const setRestAutoStart = useSettingsStore((s) => s.setRestAutoStart);
  const [display, setDisplay] = useState(() => remaining());
  const [customSecs, setCustomSecs] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Solo refresca la cuenta atrás. El fin del descanso (y la alarma) lo gobierna
  // useRestAlarm en Layout, para que dispare también desde otras pantallas.
  const tick = useCallback(() => setDisplay(remaining()), [remaining]);

  useVisibilityPausedInterval(tick, 1000, isRunning && !!endTime);

  const shown = !isRunning || !endTime ? 0 : display;
  const mins = Math.floor(shown / 60);
  const secs = shown % 60;
  const pct = duration > 0 ? Math.max(0, shown / duration) : 0;
  const urgent = shown <= 10 && shown > 0;
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

  // Descanso en marcha: píldora flotante sobre la barra inferior, como en
  // `public/screens/workout.png`. Se pulsa para desplegar los controles (+30s,
  // reiniciar, cerrar) que antes vivían bajo el círculo de 200 px.
  if (isRunning && endTime) {
    return (
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed right-4 z-40 w-[13.5rem] rounded-card border border-line bg-surface p-3 shadow-lg"
        style={{
          bottom:
            'calc(var(--bottom-nav-height) + var(--inset-bottom, env(safe-area-inset-bottom)) + 0.75rem)',
        }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={t('workout.rest_remaining')}
          className="flex w-full items-center justify-between gap-3"
        >
          <AlarmClock className={`h-5 w-5 ${urgent ? 'text-error' : 'text-accent'}`} />
          <span
            className={`font-display font-bold tabular text-xl leading-none ${
              urgent ? 'text-error' : 'text-fg'
            }`}
          >
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
        </button>

        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-pill bg-surface-3">
          <div
            className={`h-full rounded-pill transition-[width] duration-300 ease-linear ${
              urgent ? 'bg-error' : 'bg-accent'
            }`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>

        <AnimatePresence>
          {expanded && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    void impact(ImpactStyle.Light);
                    extend(30);
                  }}
                  className="min-h-11 flex-1 rounded-pill bg-accent px-2 text-xs font-bold text-accent-fg active:scale-95"
                >
                  +30s
                </button>
                <button
                  type="button"
                  onClick={() => handleStart(duration)}
                  aria-label={t('workout.rest_restart')}
                  className="flex h-11 w-11 items-center justify-center rounded-pill bg-surface-2 text-fg-muted"
                >
                  <Timer className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={stop}
                  aria-label={t('common.close')}
                  className="flex h-11 w-11 items-center justify-center rounded-pill text-fg-subtle"
                >
                  ✕
                </button>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    );
  }

  return (
    <div className="rounded-card p-4 mt-3 bg-surface border border-line shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold uppercase flex items-center gap-1.5 tracking-widest text-fg-subtle">
          <Timer className="w-3.5 h-3.5" />
          {t('workout.rest')}
        </div>
        <button
          type="button"
          onClick={() => {
            setRestAutoStart(!restAutoStart);
            void impact(ImpactStyle.Light);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-2xs font-bold uppercase tracking-wider transition-colors border ${
            restAutoStart
              ? 'bg-accent/10 text-accent border-line-accent'
              : 'bg-surface-2 text-fg-subtle border-line'
          }`}
          aria-pressed={restAutoStart}
          title={t(restAutoStart ? 'workout.rest_auto_on' : 'workout.rest_auto_off')}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${restAutoStart ? 'bg-accent' : 'bg-fg-subtle'}`}
          />
          {t(restAutoStart ? 'workout.rest_auto_on' : 'workout.rest_auto_off')}
        </button>
      </div>

      <div className="space-y-3">
        {/* Presets — siempre en segundos */}
        <div className="grid grid-cols-4 gap-1.5">
          {PRESETS.map((s) => {
            const active = s === selectedDuration && !customSecs;
            return (
              <button
                type="button"
                key={s}
                onClick={() => handleStart(s)}
                className={`py-2.5 rounded-pill text-sm font-bold transition-all active:scale-95 ${
                  active
                    ? 'bg-accent text-accent-fg shadow-glow'
                    : 'bg-surface-2 text-fg-muted border border-line'
                }`}
              >
                {`${s}s`}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => adjustCustom(-15)}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-surface-2 text-fg-muted"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleStart(selectedDuration)}
            className={`flex-1 h-9 rounded-pill text-sm font-bold transition-all active:scale-95 ${
              customSecs
                ? 'bg-accent text-accent-fg shadow-glow'
                : 'bg-surface-2 text-fg-subtle border border-dashed border-line-strong'
            }`}
          >
            {`${selectedDuration}s`}
          </button>
          <button
            type="button"
            onClick={() => adjustCustom(15)}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-surface-2 text-fg-muted"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
