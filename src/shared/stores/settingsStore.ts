import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light' | 'system';

interface SettingsState {
  sound: boolean;
  theme: Theme;
  language: string;
  setSound: (sound: boolean) => void;
  setTheme: (theme: Theme) => void;
  setLanguage: (lang: string) => void;
  /** Aplica la clase CSS al elemento :root según el tema */
  applyTheme: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      sound: true,
      theme: 'system',
      language: 'es',

      setSound: (sound) => set({ sound }),

      setTheme: (theme) => {
        set({ theme });
        get().applyTheme();
      },

      setLanguage: (language) => {
        set({ language });
        import('../lib/i18n').then((m) => m.default.changeLanguage(language));
      },

      applyTheme: () => {
        const { theme } = get();
        const root = document.documentElement;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

        root.classList.remove('dark', 'light');
        root.classList.add(isDark ? 'dark' : 'light');

        // Transición suave
        root.style.transition = 'background-color 0.3s ease, color 0.3s ease';
        setTimeout(() => {
          root.style.transition = '';
        }, 350);
      },
    }),
    { name: 'gymlog-settings' },
  ),
);
