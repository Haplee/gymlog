import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Watch, HeartPulse } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@app/components/Layout';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { devError } from '@shared/lib/devtools';
import { ConnectionCard } from '../components/ConnectionCard';
import { SleepCard } from '../components/SleepCard';
import {
  useWearableConnections,
  useWearableDaily,
  useWearableSleep,
} from '../hooks/useWearableConnections';
import { useWearableSync } from '../hooks/useWearableSync';
import { startFitbitConnect, disconnectFitbit } from '../api/fitbit';
import { isAggregatorAvailable, requestAggregatorPermission } from '../api/healthAggregator';

function formatWhen(iso: string | null | undefined, lang: string): string | undefined {
  if (!iso) return undefined;
  try {
    return new Date(iso).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function WearablesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const syncOnOpen = useSettingsStore((s) => s.wearablesSyncOnOpen);
  const setSyncOnOpen = useSettingsStore((s) => s.setWearablesSyncOnOpen);

  const { data: connections, refetch: refetchConnections } = useWearableConnections();
  const { data: dailyList } = useWearableDaily();
  const { data: sleepList } = useWearableSleep();
  const { runSync, isSyncing } = useWearableSync();
  const [aggregatorAvailable, setAggregatorAvailable] = useState(false);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    void isAggregatorAvailable().then(setAggregatorAvailable);
  }, []);

  const fitbit = (connections ?? []).find((c) => c.provider === 'fitbit');
  const isNative = Capacitor.isNativePlatform();
  const aggregatorTarget =
    Capacitor.getPlatform() === 'ios' ? t('wearables.health_aggregator') : 'Health Connect';

  const handleConnectFitbit = async () => {
    try {
      await startFitbitConnect();
    } catch (e) {
      devError('[Wearables] connect fitbit:', e);
      toast.error(t('wearables.connect_error'));
    }
  };

  const handleDisconnectFitbit = async () => {
    if (!user) return;
    try {
      await disconnectFitbit(user.id);
      await refetchConnections();
    } catch {
      toast.error(t('wearables.sync_error'));
    }
  };

  const handleGrantAggregator = async () => {
    const granted = await requestAggregatorPermission();
    if (granted) {
      await runSync();
    } else {
      toast.error(t('wearables.sync_error'));
    }
  };

  return (
    <Layout>
      <div className="space-y-3 pb-20">
        <h1 className="text-xl font-bold text-fg px-1">{t('wearables.title')}</h1>

        {/* Fitbit (web + nativo) */}
        <ConnectionCard
          title="Fitbit"
          description="Fitbit Web API"
          connected={!!fitbit}
          statusLabel={fitbit ? t('wearables.connected') : t('wearables.disconnected')}
          lastSyncLabel={
            fitbit
              ? t('wearables.last_sync', {
                  when:
                    formatWhen(fitbit.last_sync_at, i18n.language) ?? t('wearables.never_synced'),
                })
              : undefined
          }
          icon={<Watch size={22} />}
          primaryLabel={fitbit ? t('wearables.sync_now') : t('wearables.connect_fitbit')}
          onPrimary={fitbit ? () => void runSync() : () => void handleConnectFitbit()}
          secondaryLabel={fitbit ? t('wearables.disconnect') : undefined}
          onSecondary={fitbit ? () => void handleDisconnectFitbit() : undefined}
          busy={isSyncing}
        />

        {/* Agregador nativo (Health Connect / HealthKit) — solo en app */}
        {isNative ? (
          <ConnectionCard
            title={t('wearables.health_aggregator')}
            description={
              Capacitor.getPlatform() === 'ios'
                ? t('wearables.health_aggregator_desc_ios')
                : t('wearables.health_aggregator_desc_android')
            }
            connected={aggregatorAvailable}
            statusLabel={
              aggregatorAvailable ? t('wearables.connected') : t('wearables.disconnected')
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
          <div className="rounded-2xl p-4 bg-surface border border-line-strong text-xs text-fg-subtle">
            {t('wearables.health_aggregator')}: {t('wearables.not_available_web')}
          </div>
        )}

        {/* Resumen de datos */}
        {dailyList?.length || sleepList?.length ? (
          <SleepCard sleep={sleepList?.[0]} daily={dailyList?.[0]} />
        ) : (
          <div className="rounded-2xl p-4 bg-surface border border-line-strong text-xs text-fg-subtle text-center">
            {t('wearables.no_data')}
          </div>
        )}

        {/* Sincronizar al abrir */}
        <div className="rounded-2xl p-4 scale-in bg-surface border border-line-strong shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base text-fg">{t('wearables.sync_on_open')}</div>
              <div className="text-xs text-fg-subtle">{t('wearables.sync_on_open_desc')}</div>
            </div>
            <button
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
