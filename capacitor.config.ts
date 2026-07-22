import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.franvi.gymlog',
  appName: 'GymLog',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    // La app gestiona los safe-area insets vía env(safe-area-inset-*); evitamos
    // que el WKWebView añada su propio inset y duplique el espaciado.
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0a0a0b',
      showSpinner: false,
    },
    // El SystemBars de Capacitor, si el WebView es <140, mete padding-top en el
    // WebView por el alto de la barra de estado. La franja que deja al descubierto
    // la pinta el tema nativo, no la web, y por eso no seguía al tema de la app
    // (QA-01). MainActivity ya hace edge-to-edge y publica --inset-* con los px
    // reales, así que este manejo sobra y estorba.
    SystemBars: {
      insetsHandling: 'disable',
    },
    StatusBar: {
      // El color real de la barra lo pinta el propio WebView (edge-to-edge); en
      // Android 16 `setBackgroundColor` es un no-op de todos modos. El estilo de
      // los iconos lo fija settingsStore.applyTheme() según el tema de la app.
      style: 'DARK',
      overlaysWebView: true,
    },
    LocalNotifications: {
      iconColor: '#cbf24c',
      smallIcon: 'ic_stat_notify',
    },
    Keyboard: {
      // Encoge el WebView al abrir el teclado para que los inputs del final de
      // la pantalla (RPE, peso, notas) no queden tapados — con contentInset
      // 'never' en iOS el motor no redimensiona el viewport por sí solo.
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true,
    },
  },
};

export default config;
