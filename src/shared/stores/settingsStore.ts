import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type VisualStyle = 'glass' | 'intense' | 'subtle' | 'solid';

interface SettingsState {
  biometricEnabled: boolean;
  trainingReminders: boolean;
  sound: boolean;
  language: string;
  unitSystem: 'kg' | 'lb';
  showWarmupSets: boolean;
  restAutoStart: boolean;
  visualStyle: VisualStyle;
  setBiometricEnabled: (enabled: boolean) => void;
  setTrainingReminders: (enabled: boolean) => void;
  setSound: (sound: boolean) => void;
  setLanguage: (lang: string) => void;
  setUnitSystem: (unit: 'kg' | 'lb') => void;
  setShowWarmupSets: (show: boolean) => void;
  setRestAutoStart: (auto: boolean) => void;
  setVisualStyle: (style: VisualStyle) => void;
  applyTheme: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      biometricEnabled: false,
      trainingReminders: true,
      sound: true,
      language: 'es',
      unitSystem: 'kg',
      showWarmupSets: true,
      restAutoStart: false,
      visualStyle: 'glass',

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

      setVisualStyle: (visualStyle) => {
        set({ visualStyle });
        document.documentElement.setAttribute('data-style', visualStyle);
      },

      applyTheme: () => {
        const root = document.documentElement;
        root.classList.remove('light');
        root.classList.add('dark');
        root.setAttribute('data-style', get().visualStyle);
      },
    }),
    { name: 'gymlog-settings' },
  ),
);
