import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { scheduleTimerNotification, cancelTimerNotification } from '@shared/lib/notifications';

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
      start: (seconds) => {
        const endTime = Date.now() + seconds * 1000;
        set({ endTime, duration: seconds, isRunning: true });
        // Alarma del sistema: suena aunque la app esté en background
        void scheduleTimerNotification(endTime);
      },
      stop: () => {
        set({ endTime: null, isRunning: false });
        void cancelTimerNotification();
      },
      extend: (seconds) => {
        const { endTime, duration, isRunning } = get();
        if (!isRunning || !endTime) return;
        const newEnd = endTime + seconds * 1000;
        set({ endTime: newEnd, duration: duration + seconds });
        void scheduleTimerNotification(newEnd);
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
        // (la notificación del sistema ya avisó en su momento)
        if (state && state.endTime !== null && state.endTime < Date.now()) {
          state.endTime = null;
          state.isRunning = false;
        }
      },
    },
  ),
);
