import { create } from 'zustand';
import { countPendingWorkouts } from '@shared/lib/workoutOutbox';
import { devError } from '@shared/lib/devtools';

interface OutboxState {
  /** Entrenos guardados offline pendientes de sincronizar. */
  pending: number;
  refresh: () => Promise<void>;
}

export const useOutboxStore = create<OutboxState>((set) => ({
  pending: 0,
  refresh: async () => {
    try {
      set({ pending: await countPendingWorkouts() });
    } catch (err) {
      // idb no disponible (p.ej. SSR/modo privado): no romper, pero dejar rastro.
      devError('[outboxStore] refresh failed:', err);
    }
  },
}));
