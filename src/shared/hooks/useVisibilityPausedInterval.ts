import { useEffect } from 'react';

/**
 * Como setInterval, pero se pausa mientras la pestaña/app está en segundo plano
 * y recalcula de inmediato al recuperar visibilidad. Solo seguro para callbacks
 * que derivan su valor de un timestamp absoluto (no de un contador incremental).
 */
export function useVisibilityPausedInterval(
  callback: () => void,
  delayMs: number,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;

    let id: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (id !== null) return;
      callback();
      id = setInterval(callback, delayMs);
    };

    const stop = () => {
      if (id !== null) clearInterval(id);
      id = null;
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, delayMs]);
}
