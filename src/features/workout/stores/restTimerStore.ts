import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface RestTimerState {
  endTime: number | null;
  duration: number;
  isRunning: boolean;
  start: (seconds: number) => void;
  stop: () => void;
  extend: (seconds: number) => void;
  remaining: () => number;
}

export const useRestTimerStore = create<RestTimerState>()(
  persist(
    (set, get) => ({
      endTime: null,
      duration: 90,
      isRunning: false,
      start: (seconds) =>
        set({
          endTime: Date.now() + seconds * 1000,
          duration: seconds,
          isRunning: true,
        }),
      stop: () => set({ endTime: null, isRunning: false }),
      extend: (seconds) => {
        const { endTime, duration, isRunning } = get();
        if (!isRunning || !endTime) return;
        set({ endTime: endTime + seconds * 1000, duration: duration + seconds });
      },
      remaining: () => {
        const { endTime } = get();
        if (!endTime) return 0;
        return Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      },
    }),
    {
      name: 'gymlog-rest-timer',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ endTime: s.endTime, duration: s.duration, isRunning: s.isRunning }),
      onRehydrateStorage: () => (state) => {
        // Timer expirado mientras la app estaba cerrada: no rearmar
        if (state && state.endTime !== null && state.endTime < Date.now()) {
          state.endTime = null;
          state.isRunning = false;
        }
      },
    },
  ),
);
