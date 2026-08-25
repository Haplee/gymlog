import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkTimerStore } from '@features/workout/stores/workTimerStore';
import { useVisibilityPausedInterval } from '@shared/hooks/useVisibilityPausedInterval';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { Check, Play, Pause, Refresh } from '@shared/components/icons';

interface WorkTimerProps {
  /** Segundos que pide el plan, si los pide. Solo informativo. */
  targetSeconds?: number | null;
  /** Se llama al aceptar el tiempo: entrega los segundos aguantados. */
  onAccept: (seconds: number) => void;
}

/** `m:ss` a partir de segundos. Aquí siempre con minutos, que es lo que se lee corriendo. */
function reloj(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Cronómetro de la serie por tiempo: arrancar, pausar, aceptar.
 *
 * Cuenta hacia arriba y **no avisa al llegar al objetivo**. Es deliberado: en
 * una plancha lo que importa es cuánto se aguantó, no cumplir un número, y una
 * alarma a los 45 s invita a soltar justo cuando aún quedaba algo. El objetivo
 * se pinta al lado como referencia.
 *
 * El número no se guarda en el estado de React sino que se relee del store en
 * cada tick, sobre marcas absolutas: `useVisibilityPausedInterval` corta el
 * intervalo cuando la app se va a segundo plano —el WebView de Android no
 * siempre dispara `visibilitychange`, de ahí este hook y no un `setInterval`—
 * y al volver el primer tick recalcula el total real, sin haber perdido nada.
 */
export function WorkTimer({ targetSeconds, onAccept }: WorkTimerProps) {
  const { t } = useTranslation();
  const isRunning = useWorkTimerStore((s) => s.isRunning);
  const [, forceTick] = useState(0);

  useVisibilityPausedInterval(() => forceTick((n) => n + 1), 250, isRunning);

  const store = useWorkTimerStore.getState();
  const elapsed = store.elapsedSeconds();
  const enMarcha = isRunning || elapsed > 0;

  const handleToggle = () => {
    void impact(ImpactStyle.Light);
    if (isRunning) useWorkTimerStore.getState().pause();
    else if (elapsed > 0) useWorkTimerStore.getState().resume();
    else useWorkTimerStore.getState().start();
  };

  const handleAccept = () => {
    void impact(ImpactStyle.Medium);
    useWorkTimerStore.getState().pause();
    const segundos = useWorkTimerStore.getState().elapsedSeconds();
    if (segundos <= 0) return;
    onAccept(segundos);
    useWorkTimerStore.getState().reset();
  };

  return (
    <div className="rounded-card border border-line bg-surface-2 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="font-display text-4xl font-bold tabular text-fg"
          aria-live="polite"
          aria-label={t('workout.timer_elapsed', { seconds: elapsed })}
        >
          {reloj(elapsed)}
        </span>
        {targetSeconds != null && (
          <span className="label-caps text-fg-subtle">
            {t('workout.timer_target', { time: reloj(targetSeconds) })}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={isRunning ? t('workout.timer_pause') : t('workout.timer_start')}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-pill bg-accent px-4 text-accent-fg transition-transform active:scale-[0.98]"
        >
          {isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          <span className="label-caps">
            {isRunning ? t('workout.timer_pause') : t('workout.timer_start')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            void impact(ImpactStyle.Light);
            useWorkTimerStore.getState().reset();
          }}
          disabled={!enMarcha}
          aria-label={t('workout.timer_reset')}
          className="flex h-11 w-11 items-center justify-center rounded-card text-fg-subtle disabled:opacity-40"
        >
          <Refresh className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={handleAccept}
          disabled={elapsed <= 0}
          aria-label={t('workout.timer_accept')}
          className="flex h-11 w-11 items-center justify-center rounded-card bg-success/15 text-success transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100"
        >
          <Check className="h-5 w-5" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
