import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Settings {
  vibration: boolean;
  sound: boolean;
  restTimerDefault: number;
}

interface SettingsStore extends Settings {
  setVibration: (vibration: boolean) => void;
  setSound: (sound: boolean) => void;
  setRestTimerDefault: (seconds: number) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      vibration: true,
      sound: true,
      restTimerDefault: 90,
      setVibration: (vibration) => set({ vibration }),
      setSound: (sound) => set({ sound }),
      setRestTimerDefault: (restTimerDefault) => set({ restTimerDefault }),
    }),
    { name: 'gymlog-settings' }
  )
);
