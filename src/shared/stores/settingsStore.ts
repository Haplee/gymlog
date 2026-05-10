import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  biometricEnabled: boolean;
  trainingReminders: boolean;
  sound: boolean;
  language: string;
  unitSystem: 'kg' | 'lb';
  showWarmupSets: boolean;
  restAutoStart: boolean;
  setBiometricEnabled: (enabled: boolean) => void;
  setTrainingReminders: (enabled: boolean) => void;
  setSound: (sound: boolean) => void;
  setLanguage: (lang: string) => void;
  setUnitSystem: (unit: 'kg' | 'lb') => void;
  setShowWarmupSets: (show: boolean) => void;
  setRestAutoStart: (auto: boolean) => void;
  applyTheme: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      biometricEnabled: false,
      trainingReminders: true,
      sound: true,
      language: 'es',
      unitSystem: 'kg',
      showWarmupSets: true,
      restAutoStart: false,

      setBiometricEnabled: (biometricEnabled) => set({ biometricEnabled }),
      setTrainingReminders: (trainingReminders) => set({ trainingReminders }),
      setSound: (sound) => set({ sound }),

      setLanguage: (language) => {
        set({ language });
        import('../lib/i18n').then((m) => m.default.changeLanguage(language));
      },

      setUnitSystem: (unitSystem) => set({ unitSystem }),
      setShowWarmupSets: (showWarmupSets) => set({ showWarmupSets }),
      setRestAutoStart: (restAutoStart) => set({ restAutoStart }),

      applyTheme: () => {
        const root = document.documentElement;
        root.classList.remove('light');
        root.classList.add('dark');
      },
    }),
    { name: 'gymlog-settings' },
  ),
);
