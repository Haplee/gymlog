import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IsRestoringProvider, type QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
  type Persister,
} from '@tanstack/react-query-persist-client';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

/**
 * Sustituto de `PersistQueryClientProvider` con las escrituras estranguladas.
 *
 * El provider de TanStack se apoya en `persistQueryClientSubscribe`, que llama a
 * `persistQueryClientSave` en **cada** evento `added`/`removed`/`updated` de la
 * caché — y cada llamada dehidrata la caché entera antes de escribirla. Guardar
 * un entreno invalida cuatro claves y refetchea, así que eran decenas de
 * dehidrataciones completas y otras tantas escrituras a IndexedDB en menos de un
 * segundo. Estrangular solo el persister no bastaba: el `dehydrate` ocurre
 * dentro de TanStack, antes de llegar a él.
 *
 * Aquí la suscripción es propia: los eventos solo marcan «hay algo que
 * guardar» y un único temporizador hace dehydrate + escritura una vez por
 * ventana. Se conserva el resto del contrato del provider —restore una sola vez
 * al arrancar e `IsRestoringProvider`, que es lo que impide que las queries
 * hagan fetch antes de rehidratar la caché de disco— porque perderlo provocaría
 * un doble fetch y un parpadeo en cada arranque.
 */
const WRITE_DELAY_MS = 2000;

/** Los mismos eventos que vigila `persistQueryClientSubscribe`. */
const CACHE_EVENT_TYPES = ['added', 'removed', 'updated'];

interface PersistGateProps {
  client: QueryClient;
  persister: Persister;
  /** Antigüedad máxima de la caché en disco; más vieja se descarta. */
  maxAge?: number;
  children: ReactNode;
}

export function PersistGate({ client, persister, maxAge, children }: PersistGateProps) {
  const [isRestoring, setIsRestoring] = useState(true);
  // Igual que el provider original: en StrictMode los efectos corren dos veces
  // en desarrollo y no queremos rehidratar (ni leer de disco) dos veces.
  const didRestore = useRef(false);

  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;

    void persistQueryClientRestore({ queryClient: client, persister, maxAge })
      .catch(() => {
        // Caché corrupta o ilegible: TanStack ya la descarta por dentro. Seguimos
        // con caché vacía en vez de dejar la app bloqueada en el esqueleto.
      })
      .finally(() => setIsRestoring(false));
  }, [client, persister, maxAge]);

  useEffect(() => {
    if (isRestoring) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let dirty = false;

    const save = () => {
      timer = null;
      if (!dirty) return;
      dirty = false;
      void persistQueryClientSave({ queryClient: client, persister });
    };

    const markDirty = () => {
      dirty = true;
      // Throttle, no debounce: la primera marca fija el plazo y las siguientes
      // se agrupan, así una ráfaga de invalidaciones no puede aplazar el guardado.
      if (timer === null) timer = setTimeout(save, WRITE_DELAY_MS);
    };

    const onCacheEvent = (event: { type: string }) => {
      if (CACHE_EVENT_TYPES.includes(event.type)) markDirty();
    };

    const unsubscribeQueries = client.getQueryCache().subscribe(onCacheEvent);
    const unsubscribeMutations = client.getMutationCache().subscribe(onCacheEvent);

    /** Al pasar a segundo plano se guarda ya: puede que no haya vuelta. */
    const flush = () => {
      if (timer !== null) clearTimeout(timer);
      save();
    };

    const onVisibility = () => {
      if (document.hidden) flush();
    };

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);

    // En nativo el WebView puede pausarse sin que llegue visibilitychange.
    let nativeHandle: { remove: () => void } | undefined;
    let disposed = false;
    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) flush();
      }).then((h) => {
        if (disposed) void h.remove();
        else nativeHandle = h;
      });
    }

    return () => {
      disposed = true;
      unsubscribeQueries();
      unsubscribeMutations();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      nativeHandle?.remove();
      // Lo pendiente se escribe antes de soltar la suscripción.
      flush();
    };
  }, [client, persister, isRestoring]);

  return <IsRestoringProvider value={isRestoring}>{children}</IsRestoringProvider>;
}
