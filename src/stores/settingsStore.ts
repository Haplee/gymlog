import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Settings {
  theme: 'dark' | 'light';
  vibration: boolean;
  sound: boolean;
  restTimerDefault: number;
}

interface SettingsStore extends Settings {
  setTheme: (theme: 'dark' | 'light') => void;
  setVibration: (vibration: boolean) => void;
  setSound: (sound: boolean) => void;
  setRestTimerDefault: (seconds: number) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      vibration: true,
      sound: true,
      restTimerDefault: 90,
      setTheme: (theme) => set({ theme }),
      setVibration: (vibration) => set({ vibration }),
      setSound: (sound) => set({ sound }),
      setRestTimerDefault: (restTimerDefault) => set({ restTimerDefault }),
    }),
    { name: 'gymlog-settings' }
  )
);
