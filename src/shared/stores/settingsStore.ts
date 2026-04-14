import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  sound: boolean;
  language: string;
  setSound: (sound: boolean) => void;
  setLanguage: (lang: string) => void;
  /** Aplica la clase CSS al elemento :root según el tema */
  applyTheme: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sound: true,
      language: 'es',

      setSound: (sound) => set({ sound }),

      setLanguage: (language) => {
        set({ language });
        import('../lib/i18n').then((m) => m.default.changeLanguage(language));
      },

      applyTheme: () => {
        const root = document.documentElement;
        root.classList.remove('light');
        root.classList.add('dark');
      },
    }),
    { name: 'gymlog-settings' },
  ),
);
