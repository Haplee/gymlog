import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Estado ligero de sincronización de wearables (la fuente de verdad de los datos
// es Supabase; aquí solo el estado de la UI de sync).
interface WearableState {
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Sesiones de gimnasio importadas en la última sincronización. */
  strength: number;
  setSyncing: (v: boolean) => void;
  setSynced: (strength?: number) => void;
  setError: (msg: string | null) => void;
}

export const useWearableStore = create<WearableState>()(
  persist(
    (set) => ({
      isSyncing: false,
      lastSyncAt: null,
      lastError: null,
      strength: 0,
      setSyncing: (isSyncing) => set({ isSyncing }),
      setSynced: (strength = 0) =>
        set({
          isSyncing: false,
          lastSyncAt: new Date().toISOString(),
          lastError: null,
          strength,
        }),
      setError: (lastError) => set({ isSyncing: false, lastError }),
    }),
    {
      name: 'gymlog-wearables',
      storage: createJSONStorage(() => localStorage),
      // `skippedStrength` (v0) ya no existe: se persistía y quedaría colgado en
      // localStorage de instalaciones anteriores. La versión fuerza el descarte.
      version: 1,
      migrate: (persisted) => {
        const { lastSyncAt } = (persisted ?? {}) as { lastSyncAt?: string | null };
        return { lastSyncAt: lastSyncAt ?? null };
      },
      partialize: (s) => ({ lastSyncAt: s.lastSyncAt }),
    },
  ),
);
