import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

/** Eventos del plugin App que usa la aplicación, con su payload. */
interface AppEventPayloads {
  appStateChange: { isActive: boolean };
  backButton: { canGoBack: boolean };
  appUrlOpen: { url: string };
}

/**
 * Suscribe un listener del plugin App de Capacitor y lo retira al desmontar.
 *
 * `addListener` devuelve una promesa, y ahí está la trampa: si el efecto se
 * limpia antes de que resuelva, el `remove()` corre sobre un handle que todavía
 * no existe y el listener se queda colgado para siempre. En una pantalla que se
 * monta y desmonta varias veces eso acumula suscripciones duplicadas.
 *
 * El patrón estaba repetido en cinco sitios y solo dos contemplaban esa carrera.
 * Aquí se resuelve una vez: si al resolver ya no estamos montados, se retira en
 * el acto.
 *
 * En web es un no-op: el plugin solo existe en nativo.
 *
 * `handler` se guarda en una ref, así que no hace falta memorizarlo en quien
 * llama; la suscripción solo se rehace si cambia `event` o `enabled`.
 */
export function useCapacitorListener<E extends keyof AppEventPayloads>(
  event: E,
  handler: (payload: AppEventPayloads[E]) => void,
  enabled = true,
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return;

    let disposed = false;
    let handle: { remove: () => void } | undefined;

    const subscribe = CapApp.addListener(event as 'appStateChange', (payload) =>
      handlerRef.current(payload as AppEventPayloads[E]),
    );

    void subscribe.then((h) => {
      if (disposed) h.remove();
      else handle = h;
    });

    return () => {
      disposed = true;
      handle?.remove();
    };
  }, [event, enabled]);
}
