import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Capacitor } from '@capacitor/core';

export type Theme = 'dark' | 'light';

/** Color de chrome (status bar / theme-color) por tema; coincide con --bg-base. */
const THEME_CHROME: Record<Theme, string> = {
  dark: '#080808',
  light: '#eef0f3',
};

interface SettingsState {
  biometricEnabled: boolean;
  notificationsEnabled: boolean;
  trainingReminders: boolean;
  sound: boolean;
  language: string;
  theme: Theme;
  unitSystem: 'kg' | 'lb';
  showWarmupSets: boolean;
  restAutoStart: boolean;
  restDuration: number;
  setBiometricEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setTrainingReminders: (enabled: boolean) => void;
  setSound: (sound: boolean) => void;
  setLanguage: (lang: string) => void;
  setTheme: (theme: Theme) => void;
  setUnitSystem: (unit: 'kg' | 'lb') => void;
  setShowWarmupSets: (show: boolean) => void;
  setRestAutoStart: (auto: boolean) => void;
  setRestDuration: (seconds: number) => void;
  applyTheme: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      biometricEnabled: false,
      notificationsEnabled: true,
      trainingReminders: true,
      sound: true,
      language: 'es',
      theme: 'dark',
      unitSystem: 'kg',
      showWarmupSets: true,
      restAutoStart: false,
      restDuration: 90,

      setBiometricEnabled: (biometricEnabled) => set({ biometricEnabled }),

      // Espeja el flag en localStorage('notif_disabled') para que las utilidades
      // de notifications.ts (isNotificationsDisabled) lean el valor correcto sin
      // depender del store. Fuente de verdad cliente: este store persistido.
      setNotificationsEnabled: (notificationsEnabled) => {
        set({ notificationsEnabled });
        if (notificationsEnabled) localStorage.removeItem('notif_disabled');
        else localStorage.setItem('notif_disabled', 'true');
      },

      setTrainingReminders: (trainingReminders) => set({ trainingReminders }),
      setSound: (sound) => set({ sound }),

      setLanguage: (language) => {
        set({ language });
        import('../lib/i18n').then((m) => m.default.changeLanguage(language));
      },

      setTheme: (theme) => {
        set({ theme });
        get().applyTheme();
      },

      setUnitSystem: (unitSystem) => set({ unitSystem }),
      setShowWarmupSets: (showWarmupSets) => set({ showWarmupSets }),
      setRestAutoStart: (restAutoStart) => set({ restAutoStart }),
      setRestDuration: (restDuration) => set({ restDuration }),

      applyTheme: () => {
        const { theme } = get();
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);

        // Sincroniza el chrome del navegador/PWA con el tema activo
        const chrome = THEME_CHROME[theme];
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', chrome);
        // El <body> tiene un fondo #080808 inline en index.html que no adapta;
        // forzarlo aquí evita franjas oscuras en las safe-area en modo claro.
        document.body.style.backgroundColor = chrome;

        // Status bar nativa (Capacitor): texto oscuro en tema claro, claro en oscuro
        if (Capacitor.isNativePlatform()) {
          void import('@capacitor/status-bar')
            .then(({ StatusBar, Style }) => {
              void StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark });
              void StatusBar.setBackgroundColor({ color: chrome });
            })
            .catch(() => {
              /* status-bar no disponible — ignorar en web/iOS sin plugin */
            });
        }
      },
    }),
    {
      name: 'gymlog-settings',
      // Al rehidratar, espeja el flag persistido en localStorage('notif_disabled')
      // para que notifications.ts vea el estado correcto desde el primer arranque,
      // antes de que la sincronización con la DB termine.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.notificationsEnabled) localStorage.removeItem('notif_disabled');
        else localStorage.setItem('notif_disabled', 'true');
      },
    },
  ),
);
