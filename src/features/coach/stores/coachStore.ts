import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchCoachConsent, grantCoachConsent, revokeCoachConsent } from '../api/coach';

interface CoachState {
  /**
   * Espejo local del consentimiento, solo para que la UI no parpadee al
   * arrancar. La fuente de verdad es `profiles.ai_coach_enabled`: si discrepan,
   * gana el servidor (ver `sync`).
   */
  enabled: boolean;
  syncing: boolean;
  /** Carga el estado real del servidor y corrige el espejo. */
  sync: (userId: string) => Promise<void>;
  enable: (userId: string) => Promise<void>;
  disable: () => Promise<void>;
}

export const useCoachStore = create<CoachState>()(
  persist(
    (set) => ({
      enabled: false,
      syncing: false,

      sync: async (userId) => {
        set({ syncing: true });
        try {
          set({ enabled: await fetchCoachConsent(userId) });
        } catch {
          // Sin conexión no se puede confirmar el consentimiento. Se apaga:
          // ante la duda, no mandar datos de salud a ningún sitio.
          set({ enabled: false });
        } finally {
          set({ syncing: false });
        }
      },

      enable: async (userId) => {
        await grantCoachConsent(userId);
        set({ enabled: true });
      },

      disable: async () => {
        await revokeCoachConsent();
        set({ enabled: false });
      },
    }),
    {
      name: 'gymlog-coach',
      // `syncing` es estado de vuelo: persistirlo dejaría la UI cargando para
      // siempre si la app se cierra a mitad de una sincronización.
      partialize: (state) => ({ enabled: state.enabled }),
    },
  ),
);
