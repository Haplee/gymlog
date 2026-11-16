import { create } from 'zustand';
import { countPendingWorkouts } from '@shared/lib/workoutOutbox';
import { devError } from '@shared/lib/devtools';

interface OutboxState {
  /** Entrenos guardados offline pendientes de sincronizar de la cuenta activa. */
  pending: number;
  /** Epoch ms del último refresco completado; `0` si todavía no hay ninguno. */
  lastRefreshedAt: number;
  /** Cuenta a la que pertenece `pending`; `null` si no hay usuario en sesión. */
  lastRefreshedUserId: string | null;
  /** Token monotónico que identifica el último refresco solicitado. */
  refreshGeneration: number;
  /** `userId` acota el contador a esa cuenta; sin él el contador queda a cero. */
  refresh: (userId?: string | null) => Promise<void>;
  /** Deja el contador a cero al salir de la cuenta, sin tocar IndexedDB. */
  reset: () => void;
}

export const useOutboxStore = create<OutboxState>((set) => {
  let refreshGeneration = 0;

  return {
    pending: 0,
    lastRefreshedAt: 0,
    lastRefreshedUserId: null,
    refreshGeneration: 0,
    refresh: async (userId) => {
      if (!userId) {
        const generation = ++refreshGeneration;
        set({
          pending: 0,
          lastRefreshedAt: Date.now(),
          lastRefreshedUserId: null,
          refreshGeneration: generation,
        });
        return;
      }

      const generation = ++refreshGeneration;
      set({ refreshGeneration: generation });

      try {
        const pending = await countPendingWorkouts(userId);
        if (generation !== refreshGeneration) return;
        set({
          pending,
          lastRefreshedAt: Date.now(),
          lastRefreshedUserId: userId,
          refreshGeneration: generation,
        });
      } catch (err) {
        if (generation !== refreshGeneration) return;
        // idb no disponible (p.ej. SSR/modo privado): no romper, pero dejar rastro.
        devError('[outboxStore] refresh failed:', err);
      }
    },
    reset: () => {
      const generation = ++refreshGeneration;
      set({
        pending: 0,
        lastRefreshedUserId: null,
        refreshGeneration: generation,
      });
    },
  };
});
