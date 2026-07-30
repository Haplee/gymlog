import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { HeartPulse, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@app/components/Layout';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { ConnectionCard } from '../components/ConnectionCard';
import { HealthMetricsCard } from '../components/HealthMetricsCard';
import { pickDaily, pickSleepFor } from '../utils/pickDaily';
import { useWearableDaily, useWearableSleep } from '../hooks/useWearableConnections';
import { useWearableSync } from '../hooks/useWearableSync';
import { useWearableStore } from '../stores/wearableStore';
import {
  aggregatorHasPermission,
  isAggregatorAvailable,
  requestAggregatorPermission,
} from '../api/healthAggregator';

export function WearablesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const syncOnOpen = useSettingsStore((s) => s.wearablesSyncOnOpen);
  const setSyncOnOpen = useSettingsStore((s) => s.setWearablesSyncOnOpen);

  const { data: dailyList } = useWearableDaily();
  const { data: sleepList } = useWearableSleep();
  // De madrugada el día en curso aún no tiene pulsaciones: se muestra el último
  // con datos reales, con su fecha (ver pickDaily).
  const shownDay = pickDaily(dailyList);
  const { runSync, isSyncing } = useWearableSync();
  const strength = useWearableStore((s) => s.strength);
  const [aggregatorAvailable, setAggregatorAvailable] = useState(false);
  const [aggregatorGranted, setAggregatorGranted] = useState(false);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    void isAggregatorAvailable().then(setAggregatorAvailable);
    void aggregatorHasPermission().then(setAggregatorGranted);
  }, []);

  const isNative = Capacitor.isNativePlatform();
  const aggregatorTarget =
    Capacitor.getPlatform() === 'ios' ? t('wearables.health_aggregator') : 'Health Connect';

  const handleGrantAggregator = async () => {
    const granted = await requestAggregatorPermission();
    setAggregatorGranted(granted);
    if (granted) {
      await runSync();
    } else {
      toast.error(t('wearables.permission_needed'));
    }
  };

  return (
    <Layout>
      <div className="space-y-3 pb-20">
        {/* Agregador nativo (Health Connect / HealthKit) — solo en app */}
        {isNative ? (
          <ConnectionCard
            title={t('wearables.health_aggregator')}
            description={
              Capacitor.getPlatform() === 'ios'
                ? t('wearables.health_aggregator_desc_ios')
                : t('wearables.health_aggregator_desc_android')
            }
            connected={aggregatorAvailable && aggregatorGranted}
            statusLabel={
              aggregatorAvailable && aggregatorGranted
                ? t('wearables.connected')
                : t('wearables.disconnected')
            }
            icon={<HeartPulse size={22} />}
            hint={t('wearables.amazfit_hint', { target: aggregatorTarget })}
            primaryLabel={t('wearables.grant_permission')}
            onPrimary={() => void handleGrantAggregator()}
            secondaryLabel={t('wearables.sync_now')}
            onSecondary={() => void runSync()}
            busy={isSyncing}
          />
        ) : (
          <div className="rounded-card p-4 bg-surface border border-line-strong text-xs text-fg-subtle">
            {t('wearables.health_aggregator')}: {t('wearables.not_available_web')}
          </div>
        )}

        {/* Sesiones de gimnasio importadas del agregador */}
        {strength > 0 ? (
          <div className="rounded-card p-4 bg-surface border border-line-strong flex gap-3">
            <Dumbbell size={20} className="shrink-0 text-fg-subtle mt-0.5" />
            <div>
              <div className="text-sm text-fg">{t('wearables.strength_imported_title')}</div>
              <div className="text-xs text-fg-subtle mt-1">
                {t('wearables.strength_imported_desc', { count: strength })}
              </div>
            </div>
          </div>
        ) : null}

        {/* Resumen de datos */}
        {dailyList?.length || sleepList?.length ? (
          <HealthMetricsCard daily={shownDay} sleep={pickSleepFor(shownDay, sleepList)} />
        ) : (
          <div className="rounded-card p-4 bg-surface border border-line-strong text-xs text-fg-subtle text-center">
            {t('wearables.no_data')}
          </div>
        )}

        {/* Sincronizar al abrir */}
        <div className="rounded-card p-4 scale-in bg-surface border border-line-strong shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base text-fg">{t('wearables.sync_on_open')}</div>
              <div className="text-xs text-fg-subtle">{t('wearables.sync_on_open_desc')}</div>
            </div>
            <button
              type="button"
              onClick={() => setSyncOnOpen(!syncOnOpen)}
              className={`w-12 h-6 rounded-full transition-all relative ${syncOnOpen ? 'bg-accent toggle-on' : 'bg-surface-3'}`}
              aria-pressed={syncOnOpen}
              aria-label={t('wearables.sync_on_open')}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-fg shadow-sm transition-all ${syncOnOpen ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
