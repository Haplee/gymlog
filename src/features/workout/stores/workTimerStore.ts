import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Cronómetro **de trabajo**: el que corre mientras se aguanta una plancha.
 *
 * Separado de `restTimerStore` a propósito. Comparten forma pero no estado: el
 * de descanso corre entre series y este durante la serie, y en una superserie
 * por tiempo pueden solaparse. Un solo store con un flag «ahora soy el otro» es
 * la vía rápida a que una plancha se salde con el aviso de descanso sonando a
 * mitad.
 *
 * También corre al revés que el de descanso: **cuenta hacia arriba**. No hay
 * alarma ni notificación del sistema — el objetivo no es avisar de que puede
 * empezar otra vez, es medir lo que se aguantó, y para eso el usuario está
 * mirando.
 *
 * El tiempo se deriva siempre de marcas absolutas (`startedAt`, `accumulatedMs`)
 * y nunca de un contador que se incrementa: el WebView de Android congela los
 * intervalos en segundo plano, y un contador incremental perdería justo los
 * segundos que el usuario estaba aguantando.
 */
interface WorkTimerState {
  /** Epoch ms del arranque del tramo en curso; `null` = parado o en pausa. */
  startedAt: number | null;
  /** Milisegundos acumulados en tramos anteriores (tras una pausa). */
  accumulatedMs: number;
  isRunning: boolean;

  /** Arranca desde cero. Descarta lo que hubiera. */
  start: () => void;
  /** Pausa conservando lo contado. */
  pause: () => void;
  /** Reanuda tras una pausa. Sobre un cronómetro a cero equivale a `start`. */
  resume: () => void;
  /** Para y borra: vuelve a cero. */
  reset: () => void;
  /** Segundos transcurridos, redondeados hacia abajo. */
  elapsedSeconds: () => number;
}

export const useWorkTimerStore = create<WorkTimerState>()(
  persist(
    (set, get) => ({
      startedAt: null,
      accumulatedMs: 0,
      isRunning: false,

      start: () => set({ startedAt: Date.now(), accumulatedMs: 0, isRunning: true }),

      pause: () => {
        const { startedAt, accumulatedMs, isRunning } = get();
        if (!isRunning || startedAt == null) return;
        set({
          startedAt: null,
          accumulatedMs: accumulatedMs + (Date.now() - startedAt),
          isRunning: false,
        });
      },

      resume: () => {
        if (get().isRunning) return;
        set({ startedAt: Date.now(), isRunning: true });
      },

      reset: () => set({ startedAt: null, accumulatedMs: 0, isRunning: false }),

      elapsedSeconds: () => {
        const { startedAt, accumulatedMs } = get();
        const enCurso = startedAt != null ? Date.now() - startedAt : 0;
        return Math.floor((accumulatedMs + enCurso) / 1000);
      },
    }),
    {
      name: 'gymlog-work-timer',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        startedAt: s.startedAt,
        accumulatedMs: s.accumulatedMs,
        isRunning: s.isRunning,
      }),
      /**
       * Un cronómetro que seguía corriendo al cerrar la app **no** se rearma, y
       * el tramo en vuelo se descarta.
       *
       * Es distinto del temporizador de descanso, que sí puede recuperar tiempo
       * real transcurrido: allí lo que se mide es el reloj de pared, aquí lo que
       * se mide es cuánto aguantó una persona. La app pudo estar cerrada horas y
       * nadie sostiene una plancha desde ayer, así que sumar ese hueco daría un
       * récord inventado. Se conserva lo que ya estaba acumulado —eso sí se
       * contó— y se deja en pausa para que el usuario decida.
       */
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.startedAt = null;
        state.isRunning = false;
      },
    },
  ),
);
