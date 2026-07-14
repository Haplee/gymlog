import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { scheduleTimerNotification, cancelTimerNotification } from '@shared/lib/notifications';
import { startAlarm, stopAlarm } from '@shared/lib/alarm';
import { useSettingsStore } from '@shared/stores/settingsStore';

interface RestTimerState {
  endTime: number | null;
  duration: number;
  isRunning: boolean;
  /** La alarma está sonando y espera una acción explícita del usuario. */
  alarmRinging: boolean;
  start: (seconds: number) => void;
  stop: () => void;
  extend: (seconds: number) => void;
  /** El descanso ha llegado a 0: para el timer y arranca la alarma en bucle. */
  complete: () => void;
  /** Silencia la alarma (botón "Detener"). */
  dismissAlarm: () => void;
  remaining: () => number;
}

export const useRestTimerStore = create<RestTimerState>()(
  persist(
    (set, get) => ({
      endTime: null,
      duration: 90,
      isRunning: false,
      alarmRinging: false,
      start: (seconds) => {
        // Reiniciar el descanso silencia una alarma previa: si no, seguiría
        // sonando sobre el nuevo temporizador.
        stopAlarm();
        const endTime = Date.now() + seconds * 1000;
        set({ endTime, duration: seconds, isRunning: true, alarmRinging: false });
        // Alarma del sistema: suena aunque la app esté en background
        void scheduleTimerNotification(endTime);
      },
      stop: () => {
        stopAlarm();
        set({ endTime: null, isRunning: false, alarmRinging: false });
        void cancelTimerNotification();
      },
      extend: (seconds) => {
        const { endTime, duration, isRunning } = get();
        if (!isRunning || !endTime) return;
        stopAlarm();
        const newEnd = endTime + seconds * 1000;
        set({ endTime: newEnd, duration: duration + seconds, alarmRinging: false });
        void scheduleTimerNotification(newEnd);
      },
      complete: () => {
        if (get().alarmRinging) return;
        set({ endTime: null, isRunning: false, alarmRinging: true });
        // La notificación nativa ya no hace falta: la app está en foreground y
        // suena la alarma in-app.
        void cancelTimerNotification();
        startAlarm({ sound: useSettingsStore.getState().sound });
      },
      dismissAlarm: () => {
        stopAlarm();
        set({ alarmRinging: false });
        // La notificación nativa es `ongoing`: si llegó a dispararse (app en
        // background), sigue en la bandeja hasta que la retiremos aquí.
        void cancelTimerNotification();
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
