import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

/**
 * Gestión del botón/gesto de atrás en Android.
 *
 * El WebView es una SPA: `webView.canGoBack()` no refleja la navegación del
 * router, así que el atrás se decide aquí en JS. Prioridad:
 *
 *   1. Overlay abierto (hojas, drawer, diálogos) → se cierra.
 *   2. El historial de la SPA puede retroceder → `history.back()`.
 *   3. En la raíz → el handler nativo queda desactivado para que el SISTEMA
 *      maneje el gesto: reproduce la animación predictiva de salida
 *      (Android 13+, `enableOnBackInvokedCallback` en el manifest) y cierra la
 *      app, como manda Android.
 *
 * La activación del handler nativo se sincroniza con el estado (ruta + overlays)
 * porque el sistema necesita saber ANTES del gesto si la app va a interceptarlo
 * (modelo ahead-of-time de predictive back): si el callback de Capacitor está
 * activo, el sistema no anima y nos entrega el evento; si está desactivado,
 * anima la salida y cierra la app.
 */

type BackAction = () => void | boolean;

const overlays: { id: string; action: BackAction }[] = [];
let nativeHandlerEnabled = true;

/**
 * Un overlay abierto que debe capturar «atrás» antes que la navegación.
 * Devuelve una función para darse de baja (llamarla al cerrarse).
 */
export function registerBackAction(id: string, action: BackAction): () => void {
  overlays.push({ id, action });
  syncNativeHandler();
  return () => {
    const i = overlays.findIndex((o) => o.id === id);
    if (i !== -1) overlays.splice(i, 1);
    syncNativeHandler();
  };
}

/** El overlay más reciente tiene prioridad. */
function topAction(): BackAction | undefined {
  return overlays.length ? overlays[overlays.length - 1].action : undefined;
}

/** React Router marca cada entrada de historial con state.idx; idx > 0 = hay atrás. */
function canHistoryBack(): boolean {
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' && state.idx > 0;
}

function syncNativeHandler(): void {
  if (!Capacitor.isNativePlatform()) return;
  const shouldEnable = canHistoryBack() || topAction() !== undefined;
  if (shouldEnable === nativeHandlerEnabled) return;
  nativeHandlerEnabled = shouldEnable;
  // Capacitor serializa las llamadas en el hilo nativo; ante un fallo se deja
  // el handler activo (comportamiento seguro: no se pierde el atrás).
  void CapApp.toggleBackButtonHandler({ enabled: shouldEnable }).catch(() => {
    nativeHandlerEnabled = true;
  });
}

function handleBack(): void {
  const action = topAction();
  if (action) {
    action();
    return;
  }
  if (canHistoryBack()) {
    window.history.back();
    return;
  }
  // Raíz sin overlays: el handler ya está desactivado (syncNativeHandler),
  // así que este caso solo se alcanza defensivamente. Dejamos que el sistema
  // gestione el gesto.
  syncNativeHandler();
}

/**
 * Arranca el listener de «atrás» (solo Android). Devuelve la función de limpieza.
 */
export function initPredictiveBack(): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  let dispose = () => {};
  void CapApp.addListener('backButton', () => {
    handleBack();
  }).then((handle) => {
    dispose = () => void handle.remove();
  });
  syncNativeHandler();
  return () => dispose();
}

/**
 * Mantiene el handler nativo alineado con el historial. Llamar en cada cambio
 * de ruta (useEffect sobre location.key).
 */
export function syncBackState(): void {
  syncNativeHandler();
}
