import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  sound: boolean;
  setSound: (sound: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      sound: true,
      setSound: (sound) => set({ sound }),
    }),
    { name: 'gymlog-settings' }
  )
);
