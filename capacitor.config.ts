import type { CapacitorConfig } from '@capacitor/cli';

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
      backgroundColor: '#080808',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#080808',
      overlaysWebView: true,
    },
    LocalNotifications: {
      iconColor: '#c8ff00',
      smallIcon: 'icon',
    },
  },
};

export default config;
