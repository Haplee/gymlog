import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Capacitor } from '@capacitor/core';
import { DEFAULT_ACCENT, getAccentPreset, type AccentId } from '@shared/constants/accents';
import { DEFAULT_PLATES_KG } from '@shared/lib/plates';

/** Tema elegido por el usuario: 'system' sigue al modo claro/oscuro del sistema. */
export type Theme = 'dark' | 'light' | 'system';

/** Color de chrome (status bar / theme-color) por tema; coincide con --bg-canvas. */
const THEME_CHROME: Record<'dark' | 'light', string> = {
  dark: '#0a0a0b',
  light: '#e9ebe8',
};

/** Tema efectivo a aplicar: 'system' resuelve contra el modo del sistema. */
export function resolveTheme(theme: Theme, systemDark: boolean): 'dark' | 'light' {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

/** Evita registrar la escucha del modo del sistema más de una vez por sesión. */
let systemThemeSyncStarted = false;

interface SettingsState {
  biometricEnabled: boolean;
  notificationsEnabled: boolean;
  trainingReminders: boolean;
  sound: boolean;
  language: string;
  theme: Theme;
  /** Modo oscuro del sistema (solo relevante cuando theme === 'system'). */
  systemDark: boolean;
  unitSystem: 'kg' | 'lb';
  showWarmupSets: boolean;
  restAutoStart: boolean;
  restDuration: number;
  restByExercise: boolean;
  /** Precargar el peso de la última sesión al empezar una rutina. */
  autoFillWeights: boolean;
  wearablesSyncOnOpen: boolean;
  /** La guía de uso solo se abre sola la primera vez; luego se entra desde Ajustes. */
  guideSeen: boolean;
  /** Color de acento elegido por el usuario (Ajustes → Preferencias). */
  accentColor: AccentId;
  /**
   * Icono del lanzador. Va aparte del acento a propósito: cambiarlo saca el
   * icono de la pantalla de inicio, así que no puede ser un efecto colateral
   * de probar colores.
   */
  appIcon: AccentId;
  /**
   * Discos que hay en el gimnasio del usuario, en kg. La calculadora sin esto
   * asume el juego olímpico estándar y propone discos que no existen en su sala.
   */
  availablePlatesKg: number[];
  setBiometricEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setTrainingReminders: (enabled: boolean) => void;
  setSound: (sound: boolean) => void;
  setLanguage: (lang: string) => void;
  setTheme: (theme: Theme) => void;
  /** Actualiza el modo oscuro del sistema detectado (usado por theme 'system'). */
  setSystemDark: (dark: boolean) => void;
  /** Arranca la escucha del modo del sistema y lo sincroniza una vez. */
  initSystemThemeSync: () => void;
  setUnitSystem: (unit: 'kg' | 'lb') => void;
  setShowWarmupSets: (show: boolean) => void;
  setRestAutoStart: (auto: boolean) => void;
  setRestDuration: (seconds: number) => void;
  setRestByExercise: (enabled: boolean) => void;
  setAutoFillWeights: (enabled: boolean) => void;
  setWearablesSyncOnOpen: (enabled: boolean) => void;
  setGuideSeen: (seen: boolean) => void;
  setAccentColor: (accent: AccentId) => void;
  setAppIcon: (icon: AccentId) => void;
  setAvailablePlatesKg: (plates: number[]) => void;
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
      systemDark: false,
      unitSystem: 'kg',
      showWarmupSets: true,
      restAutoStart: false,
      restDuration: 90,
      restByExercise: true,
      autoFillWeights: true,
      wearablesSyncOnOpen: true,
      guideSeen: false,
      accentColor: DEFAULT_ACCENT,
      appIcon: DEFAULT_ACCENT,
      availablePlatesKg: [...DEFAULT_PLATES_KG],

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
        if (theme === 'system') get().initSystemThemeSync();
      },

      setSystemDark: (systemDark) => {
        set({ systemDark });
        if (get().theme === 'system') get().applyTheme();
      },

      initSystemThemeSync: () => {
        if (systemThemeSyncStarted) return;
        systemThemeSyncStarted = true;

        const { setSystemDark } = get();
        import('../lib/systemTheme').then(({ getSystemDark, onSystemDarkChange }) => {
          // Valor inicial (evita un arranque con el tema equivocado si el
          // usuario eligió «Sistema» y el modo real es distinto del por defecto).
          void getSystemDark().then((dark) => setSystemDark(dark));

          // Cambios posteriores del sistema (cambio de modo claro/oscuro).
          onSystemDarkChange((dark) => setSystemDark(dark));
        });
      },

      setUnitSystem: (unitSystem) => set({ unitSystem }),
      setShowWarmupSets: (showWarmupSets) => set({ showWarmupSets }),
      setRestAutoStart: (restAutoStart) => set({ restAutoStart }),
      setRestDuration: (restDuration) => set({ restDuration }),
      setRestByExercise: (restByExercise) => set({ restByExercise }),
      setAutoFillWeights: (autoFillWeights) => set({ autoFillWeights }),
      setWearablesSyncOnOpen: (wearablesSyncOnOpen) => set({ wearablesSyncOnOpen }),
      setGuideSeen: (guideSeen) => set({ guideSeen }),

      setAccentColor: (accentColor) => {
        set({ accentColor });
        get().applyTheme();
      },

      // El cambio nativo lo dispara la pantalla de Ajustes, que es quien puede
      // avisar del efecto en la pantalla de inicio y mostrar el error si falla.
      setAppIcon: (appIcon) => set({ appIcon }),
      // Ordenados de mayor a menor y sin duplicados: la calculadora los recorre
      // en ese orden y así no depende de cómo los haya ido tocando el usuario.
      setAvailablePlatesKg: (plates) =>
        set({ availablePlatesKg: [...new Set(plates)].sort((a, b) => b - a) }),

      applyTheme: () => {
        const { theme, systemDark, accentColor } = get();
        const resolved = resolveTheme(theme, systemDark);
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(resolved);

        // El acento elegido se inyecta como estilo inline en :root, que gana a
        // los valores de tokens.css en ambos temas. Cada preset trae su pareja
        // oscuro/claro porque en claro el acento también se usa como texto y
        // tiene que ser oscuro para cumplir el contraste AA sobre blanco.
        const accent = getAccentPreset(accentColor)[resolved];
        root.style.setProperty('--interactive-primary', accent.primary);
        root.style.setProperty('--interactive-primary-dim', accent.dim);
        root.style.setProperty('--interactive-primary-fg', accent.fg);
        root.style.setProperty('--accent-rgb', accent.rgb);

        // Sincroniza el chrome del navegador/PWA con el tema activo
        const chrome = THEME_CHROME[resolved];
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', chrome);
        // El <body> tiene un fondo #0a0a0b inline en index.html que no adapta;
        // forzarlo aquí evita franjas oscuras en las safe-area en modo claro.
        document.body.style.backgroundColor = chrome;

        // Capa nativa (Android): fondo de la ventana + preferencia persistida
        // para que el splash del próximo arranque salga con el tema correcto.
        if (Capacitor.isNativePlatform()) {
          void import('../lib/systemTheme').then(({ syncNativeTheme }) => {
            syncNativeTheme(theme, chrome);
          });
        }

        // Status bar nativa (Capacitor): texto oscuro en tema claro, claro en oscuro
        if (Capacitor.isNativePlatform()) {
          void import('@capacitor/status-bar')
            .then(({ StatusBar, Style }) => {
              void StatusBar.setStyle({ style: resolved === 'light' ? Style.Light : Style.Dark });
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
