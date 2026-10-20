import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRestTimerStore } from '../stores/restTimerStore';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { useVisibilityPausedInterval } from '@shared/hooks/useVisibilityPausedInterval';
import { m, AnimatePresence } from 'framer-motion';
import { AlarmClock, Timer, X } from '@shared/components/icons';

/**
 * Píldora flotante del descanso **en marcha**, sobre la barra inferior
 * (como en `public/screens/workout.png`).
 *
 * Vive aparte de `RestTimer` porque la sesión guiada también la necesita: el
 * descanso es el mismo y se cuenta una sola vez, pero se entra a él desde dos
 * pantallas distintas. Si se montara solo dentro de `RestTimer`, empezar el
 * descanso en la sesión de rutina no enseñaría ninguna cuenta atrás —el store
 * correría, el aviso sonaría, y el usuario no vería nada—.
 *
 * Se dibuja **solo si hay descanso en curso**: así puede montarse en cualquier
 * pantalla sin traer consigo la tarjeta de presets, que es de la pantalla de
 * entrenamiento libre.
 */
export function RestTimerPill() {
  const { t } = useTranslation();
  // Selectores finos: este componente se re-renderiza cada segundo por su propio
  // tick, así que no debe hacerlo además por cualquier cambio ajeno del store.
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
  const [display, setDisplay] = useState(() => remaining());
  const [expanded, setExpanded] = useState(false);

  // Solo refresca la cuenta atrás. El fin del descanso (y la alarma) lo gobierna
  // useRestAlarm en Layout, para que dispare también desde otras pantallas.
  const tick = useCallback(() => setDisplay(remaining()), [remaining]);

  useVisibilityPausedInterval(tick, 1000, isRunning && !!endTime);

  if (!isRunning || !endTime) return null;

  const shown = display;
  const mins = Math.floor(shown / 60);
  const secs = shown % 60;
  const pct = duration > 0 ? Math.max(0, shown / duration) : 0;
  const urgent = shown <= 10 && shown > 0;

  const handleStart = (s: number) => {
    start(s);
    void impact(ImpactStyle.Light);
  };

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed right-4 z-40 w-[13.5rem] glass-2 rounded-card p-3 shadow-lg"
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
                <X className="h-5 w-5" />
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
