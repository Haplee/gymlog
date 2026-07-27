import { useCallback, useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
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
  HEALTH_SESSIONS_KEY,
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

/** Ventana mínima entre resyncs al volver a primer plano. */
const RESYNC_MIN_MS = 15 * 60 * 1000;

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
    queryClient.invalidateQueries({ queryKey: HEALTH_SESSIONS_KEY(userId) });
    // Workouts importados viven en cardio_sessions.
    queryClient.invalidateQueries({ queryKey: ['workoutsAndSets'] });
  }, [queryClient, userId]);

  const runSync = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!userId || useWearableStore.getState().isSyncing) return;
      const aggregator = await isAggregatorAvailable();
      if (!aggregator) return;

      setSyncing(true);
      const totals: WearableSyncResult = { daily: 0, sleep: 0, workouts: 0, strength: 0 };
      try {
        const r = await syncAggregator(userId, 7);
        totals.daily += r.daily;
        totals.sleep += r.sleep;
        totals.workouts += r.workouts;
        totals.strength += r.strength;
        setSynced(totals.strength);
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

  // Resync al volver a primer plano. Sin esto, el único disparo era el arranque
  // en frío: si la app se quedaba en segundo plano, un entreno registrado en la
  // app de salud tardaba horas en aparecer (medido: ~2h). Además Health Connect
  // deniega leer datos de otras apps DESDE segundo plano, así que el momento de
  // volver a primer plano es justo cuando la lectura tiene permiso.
  useEffect(() => {
    if (!userId || !syncOnOpen) return;
    const handle = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      const { lastSyncAt } = useWearableStore.getState();
      // Estrangulado: alternar de app no debe castigar batería ni a Health
      // Connect. 15 min es holgado frente a lo que tarda un reloj en volcar.
      if (lastSyncAt && Date.now() - new Date(lastSyncAt).getTime() < RESYNC_MIN_MS) return;
      void runSync({ silent: true });
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [userId, syncOnOpen, runSync]);

  return { runSync, isSyncing };
}
