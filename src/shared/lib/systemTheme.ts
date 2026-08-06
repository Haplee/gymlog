import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

interface ThemeBridgeNative {
  getSystemDark(): Promise<{ dark: boolean }>;
  setWindowBackground(options: { color: string }): Promise<void>;
  persistTheme(options: { theme: string }): Promise<void>;
}

/**
 * Plugin registrado en MainActivity (ThemeBridgePlugin.kt). En web nunca se
 * llama: `syncNativeTheme` y `getSystemDark` comprueban la plataforma antes.
 */
const ThemeBridge = registerPlugin<ThemeBridgeNative>('ThemeBridge');

export type SystemDarkListener = (dark: boolean) => void;

function matchMediaDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Modo oscuro del sistema. En web usa prefers-color-scheme; en Android, nativo. */
export function getSystemDark(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return Promise.resolve(matchMediaDark());
  }
  return ThemeBridge.getSystemDark()
    .then((r) => r.dark)
    .catch(() => matchMediaDark());
}

/**
 * Suscribe cambios del modo claro/oscuro del sistema. Devuelve una función para
 * cancelar la suscripción. En Android el evento lo emite MainActivity
 * (onConfigurationChanged); en web, la media query estándar.
 */
export function onSystemDarkChange(listener: SystemDarkListener): () => void {
  if (Capacitor.isNativePlatform()) {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.dark === 'boolean') listener(detail.dark);
    };
    window.addEventListener('systemThemeChanged', handler);
    return () => window.removeEventListener('systemThemeChanged', handler);
  }
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => listener(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

/**
 * Sincroniza la capa nativa con el tema de la app (solo Android): pinta el
 * fondo de la ventana (evita franjas en transiciones en tema claro) y espeja la
 * preferencia para que el splash del próximo arranque salga con el tema correcto.
 */
export function syncNativeTheme(theme: string, chromeColor: string): void {
  if (!Capacitor.isNativePlatform()) return;
  void ThemeBridge.setWindowBackground({ color: chromeColor }).catch(() => {
    /* plugin no disponible — el WebView cubre el fondo de todos modos */
  });
  void ThemeBridge.persistTheme({ theme }).catch(() => {
    /* no crítico: el splash volvería al tema por defecto en el próximo arranque */
  });
}
