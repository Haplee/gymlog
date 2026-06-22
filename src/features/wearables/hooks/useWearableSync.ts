import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { devError } from '@shared/lib/devtools';
import { syncFitbit } from '../api/fitbit';
import { isAggregatorAvailable, syncAggregator } from '../api/healthAggregator';
import { useWearableStore } from '../stores/wearableStore';
import { useWearableConnections } from './useWearableConnections';
import {
  WEARABLE_CONNECTIONS_KEY,
  WEARABLE_DAILY_KEY,
  WEARABLE_SLEEP_KEY,
} from '../api/wearablesQueries';
import type { WearableSyncResult } from '../types';

/**
 * Orquesta la sincronización de todas las fuentes conectadas:
 *  - Fitbit (vía edge function) si hay conexión.
 *  - Agregador nativo (Health Connect / HealthKit) si está disponible.
 * Devuelve runSync (manual) y dispara sync al abrir si el usuario lo activó.
 */
export function useWearableSync() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const userId = user?.id;
  const syncOnOpen = useSettingsStore((s) => s.wearablesSyncOnOpen);
  const queryClient = useQueryClient();
  const { data: connections } = useWearableConnections();
  const { isSyncing, setSyncing, setSynced, setError } = useWearableStore();
  const ranOnOpen = useRef(false);

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
      const hasFitbit = (connections ?? []).some((c) => c.provider === 'fitbit');
      const aggregator = await isAggregatorAvailable();
      if (!hasFitbit && !aggregator) return;

      setSyncing(true);
      const totals: WearableSyncResult = { daily: 0, sleep: 0, workouts: 0 };
      try {
        if (hasFitbit) {
          const r = await syncFitbit(7);
          totals.daily += r.daily;
          totals.sleep += r.sleep;
          totals.workouts += r.workouts;
        }
        if (aggregator) {
          const r = await syncAggregator(userId, 7);
          totals.daily += r.daily;
          totals.sleep += r.sleep;
          totals.workouts += r.workouts;
        }
        setSynced();
        invalidate();
        if (!opts.silent) {
          toast.success(
            t('wearables.sync_ok', {
              daily: totals.daily,
              sleep: totals.sleep,
              workouts: totals.workouts,
            }),
          );
        }
      } catch (e) {
        devError('[Wearables] sync failed:', e);
        setError(String(e));
        if (!opts.silent) toast.error(t('wearables.sync_error'));
      }
    },
    [userId, connections, setSyncing, setSynced, setError, invalidate, t],
  );

  // Foreground-on-open: una vez por montaje, si el usuario lo tiene activado.
  useEffect(() => {
    if (ranOnOpen.current) return;
    if (!userId || !syncOnOpen) return;
    // Espera a tener el estado de conexiones cargado.
    if (connections === undefined) return;
    ranOnOpen.current = true;
    void runSync({ silent: true });
  }, [userId, syncOnOpen, connections, runSync]);

  return { runSync, isSyncing };
}
