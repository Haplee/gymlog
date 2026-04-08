import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RestTimerStore {
  seconds: number;
  isRunning: boolean;
  setSeconds: (s: number) => void;
  setIsRunning: (r: boolean) => void;
  startRest: (sec: number) => void;
  stopRest: () => void;
}

export const useRestTimerStore = create<RestTimerStore>()(
  persist(
    (set) => ({
      seconds: 0,
      isRunning: false,
      setSeconds: (seconds) => set({ seconds }),
      setIsRunning: (isRunning) => set({ isRunning }),
      startRest: (sec) => set({ seconds: sec, isRunning: true }),
      stopRest: () => set({ seconds: 0, isRunning: false }),
    }),
    { name: 'gymlog-timer', partialize: (state) => ({ seconds: state.seconds, isRunning: state.isRunning }) }
  )
);
