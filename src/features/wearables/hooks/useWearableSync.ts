import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { devError } from '@shared/lib/devtools';
import { isAggregatorAvailable, syncAggregator } from '../api/healthAggregator';
import { useWearableStore } from '../stores/wearableStore';
import { useWearableConnections } from './useWearableConnections';
import {
  WEARABLE_CONNECTIONS_KEY,
  WEARABLE_DAILY_KEY,
  WEARABLE_SLEEP_KEY,
} from '../api/wearablesQueries';
import type { WearableSyncResult } from '../types';

// Módulo (no ref de componente): el hook se invoca desde Layout, que se
// remonta en cada cambio de página (cada página envuelve su propio <Layout>).
// Un ref por-instancia se reiniciaría en cada navegación y dispararía el sync
// una y otra vez; esta bandera vive mientras dure la sesión de la app.
let ranOnOpenThisSession = false;

/**
 * Orquesta la sincronización del agregador nativo (Health Connect / HealthKit)
 * si está disponible. Devuelve runSync (manual) y dispara sync al abrir la
 * app (una vez por sesión, desde Layout) si el usuario lo activó.
 */
export function useWearableSync() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const userId = user?.id;
  const syncOnOpen = useSettingsStore((s) => s.wearablesSyncOnOpen);
  const queryClient = useQueryClient();
  const { data: connections } = useWearableConnections();
  const { isSyncing, setSyncing, setSynced, setError } = useWearableStore();

  const invalidate = useCallback(() => {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: WEARABLE_DAILY_KEY(userId) });
    queryClient.invalidateQueries({ queryKey: WEARABLE_SLEEP_KEY(userId) });
    queryClient.invalidateQueries({ queryKey: WEARABLE_CONNECTIONS_KEY(userId) });
    // Workouts importados viven en cardio_sessions.
    queryClient.invalidateQueries({ queryKey: ['workoutsAndSets'] });
  }, [queryClient, userId]);

  const runSync = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!userId || useWearableStore.getState().isSyncing) return;
      const aggregator = await isAggregatorAvailable();
      if (!aggregator) return;

      setSyncing(true);
      const totals: WearableSyncResult = { daily: 0, sleep: 0, workouts: 0, skippedStrength: 0 };
      try {
        const r = await syncAggregator(userId, 7);
        totals.daily += r.daily;
        totals.sleep += r.sleep;
        totals.workouts += r.workouts;
        totals.skippedStrength += r.skippedStrength;
        setSynced(totals.skippedStrength);
        invalidate();
        if (!opts.silent) {
          toast.success(
            t('wearables.sync_ok', {
              daily: totals.daily,
              sleep: totals.sleep,
              workouts: totals.workouts,
            }),
          );
          // Aviso aparte (no silencioso) de las sesiones de fuerza detectadas
          // pero no importadas — mezclarlo en sync_ok pasaría desapercibido.
          if (totals.skippedStrength > 0) {
            toast.info(
              t('wearables.strength_not_imported_desc', { count: totals.skippedStrength }),
            );
          }
        }
      } catch (e) {
        devError('[Wearables] sync failed:', e);
        setError(String(e));
        if (!opts.silent) {
          const noPermission = e instanceof Error && e.message === 'no_permission';
          toast.error(t(noPermission ? 'wearables.permission_needed' : 'wearables.sync_error'));
        }
      }
    },
    [userId, setSyncing, setSynced, setError, invalidate, t],
  );

  // Foreground-on-open: una vez por sesión de app, si el usuario lo tiene activado.
  useEffect(() => {
    if (ranOnOpenThisSession) return;
    if (!userId || !syncOnOpen) return;
    // Espera a tener el estado de conexiones cargado.
    if (connections === undefined) return;
    ranOnOpenThisSession = true;
    void runSync({ silent: true });
  }, [userId, syncOnOpen, connections, runSync]);

  return { runSync, isSyncing };
}
