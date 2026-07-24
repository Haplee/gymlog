import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Estado ligero de sincronización de wearables (la fuente de verdad de los datos
// es Supabase; aquí solo el estado de la UI de sync).
interface WearableState {
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Sesiones de fuerza vistas en la última sincronización y no importadas
   * (no traen ejercicios/series/pesos reconstruibles). */
  skippedStrength: number;
  setSyncing: (v: boolean) => void;
  setSynced: (skippedStrength?: number) => void;
  setError: (msg: string | null) => void;
}

export const useWearableStore = create<WearableState>()(
  persist(
    (set) => ({
      isSyncing: false,
      lastSyncAt: null,
      lastError: null,
      skippedStrength: 0,
      setSyncing: (isSyncing) => set({ isSyncing }),
      setSynced: (skippedStrength = 0) =>
        set({
          isSyncing: false,
          lastSyncAt: new Date().toISOString(),
          lastError: null,
          skippedStrength,
        }),
      setError: (lastError) => set({ isSyncing: false, lastError }),
    }),
    {
      name: 'gymlog-wearables',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lastSyncAt: s.lastSyncAt, skippedStrength: s.skippedStrength }),
    },
  ),
);
