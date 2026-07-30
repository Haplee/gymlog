import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import type { StateStorage } from 'zustand/middleware';

/**
 * `localStorage` agrupado para el middleware `persist` de zustand.
 *
 * `persist` escribe en cada `set()`, y `localStorage.setItem` es síncrono: el
 * store de entreno hacía un `JSON.stringify` del estado completo + una escritura
 * a disco **por cada tecla** en los inputs de reps/kg. Aquí las escrituras se
 * agrupan en una ventana corta y se vuelca de inmediato cuando la app pasa a
 * segundo plano, que es cuando de verdad importa que el estado esté a salvo.
 *
 * Es un throttle, no un debounce: la primera escritura programa el volcado y las
 * siguientes solo actualizan el búfer, así teclear sin parar no puede aplazar el
 * guardado indefinidamente. El peor caso de pérdida es un kill del proceso sin
 * `pagehide` ni `appStateChange` en la ventana de agrupación: la última tecla.
 */
const DEFAULT_DELAY_MS = 600;

/** Búfer compartido por todos los stores: un solo volcado los cubre a todos. */
const pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Vuelca ya todo lo pendiente. Idempotente. */
export function flushThrottledStorage(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending.size === 0) return;
  for (const [key, value] of pending) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Cuota llena o almacenamiento bloqueado: no hay nada que hacer aquí, y
      // reventar dejaría el resto de claves sin escribir.
    }
  }
  pending.clear();
}

let listenersReady = false;

/**
 * Registra los disparadores de volcado una única vez. No se desregistran a
 * propósito: viven lo que vive la app y son tres en total.
 */
function ensureFlushOnBackground(): void {
  if (listenersReady || typeof window === 'undefined') return;
  listenersReady = true;

  // pagehide cubre recarga y cierre de pestaña; visibilitychange cubre cambiar
  // de app y apagar la pantalla, que en Android es la salida habitual.
  window.addEventListener('pagehide', flushThrottledStorage);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushThrottledStorage();
  });

  // En nativo el WebView puede pausarse sin que llegue visibilitychange.
  if (Capacitor.isNativePlatform()) {
    void CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) flushThrottledStorage();
    });
  }
}

/**
 * Storage para `createJSONStorage`. `getItem` lee del búfer antes que del disco
 * para que un `persist` con rehidratación inmediata nunca vea datos viejos.
 */
export function createThrottledLocalStorage(delayMs = DEFAULT_DELAY_MS): StateStorage {
  ensureFlushOnBackground();
  return {
    getItem: (name) => {
      const buffered = pending.get(name);
      return buffered !== undefined ? buffered : localStorage.getItem(name);
    },
    setItem: (name, value) => {
      pending.set(name, value);
      if (timer === null) timer = setTimeout(flushThrottledStorage, delayMs);
    },
    removeItem: (name) => {
      pending.delete(name);
      localStorage.removeItem(name);
    },
  };
}
