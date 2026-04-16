import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  biometricEnabled: boolean;
  trainingReminders: boolean;
  sound: boolean;
  language: string;
  setBiometricEnabled: (enabled: boolean) => void;
  setTrainingReminders: (enabled: boolean) => void;
  setSound: (sound: boolean) => void;
  setLanguage: (lang: string) => void;
  /** Aplica la clase CSS al elemento :root según el tema */
  applyTheme: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      biometricEnabled: false,
      trainingReminders: true,
      sound: true,
      language: 'es',

      setBiometricEnabled: (biometricEnabled) => set({ biometricEnabled }),
      setTrainingReminders: (trainingReminders) => set({ trainingReminders }),
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
