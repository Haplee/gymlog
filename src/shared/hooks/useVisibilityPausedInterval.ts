import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

/**
 * Como setInterval, pero se pausa mientras la pestaña/app está en segundo plano
 * y recalcula de inmediato al recuperar visibilidad. Solo seguro para callbacks
 * que derivan su valor de un timestamp absoluto (no de un contador incremental).
 *
 * Se escucha `visibilitychange` **y** el `appStateChange` de Capacitor: en el
 * WebView de Android el primero no siempre llega al pausarse la Activity, y sin
 * la segunda señal el intervalo seguía despertando la CPU cada segundo con la
 * app en segundo plano. Cualquiera de las dos basta para pausar; hace falta que
 * ninguna indique "oculto" para reanudar.
 */
export function useVisibilityPausedInterval(
  callback: () => void,
  delayMs: number,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;

    let id: ReturnType<typeof setInterval> | null = null;
    /** Segundo plano según Capacitor; independiente de document.hidden. */
    let appInBackground = false;
    let disposed = false;

    const start = () => {
      if (id !== null || disposed) return;
      callback();
      id = setInterval(callback, delayMs);
    };

    const stop = () => {
      if (id !== null) clearInterval(id);
      id = null;
    };

    const sync = () => (document.hidden || appInBackground ? stop() : start());

    const onVisibility = () => sync();

    start();
    document.addEventListener('visibilitychange', onVisibility);

    let handle: { remove: () => void } | undefined;
    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        appInBackground = !isActive;
        sync();
      }).then((h) => {
        // El listener puede resolverse después del cleanup: si ya no estamos,
        // se retira en el acto en vez de quedar colgado.
        if (disposed) void h.remove();
        else handle = h;
      });
    }

    return () => {
      disposed = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      handle?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, delayMs]);
}
