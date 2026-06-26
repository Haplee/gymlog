import { Capacitor } from '@capacitor/core';
import HealthBridge from '@shared/lib/healthBridge';
import { supabase } from '@shared/lib/supabase';
import { devError } from '@shared/lib/devtools';
import type { WearableProvider, WearableSyncResult } from '../types';

// Sincroniza desde el agregador de salud nativo (Health Connect / HealthKit).
// Por aquí entran Amazfit (vía Zepp), Samsung, Garmin, Apple Watch, etc.
// Lee con el plugin nativo y upserta en Supabase como el usuario (RLS aplica).

export function aggregatorSource(): WearableProvider | null {
  const p = Capacitor.getPlatform();
  if (p === 'android') return 'health_connect';
  if (p === 'ios') return 'healthkit';
  return null;
}

export async function isAggregatorAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { available } = await HealthBridge.isAvailable();
    return available;
  } catch {
    return false;
  }
}

export async function requestAggregatorPermission(): Promise<boolean> {
  try {
    const { granted } = await HealthBridge.requestAuthorization();
    return granted;
  } catch (e) {
    devError('[HealthAggregator] permission error:', e);
    return false;
  }
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Lee del agregador nativo y upserta en Supabase. Devuelve el conteo importado. */
export async function syncAggregator(userId: string, days = 7): Promise<WearableSyncResult> {
  const source = aggregatorSource();
  if (!source) throw new Error('no_aggregator');

  const end = new Date();
  const start = new Date(Date.now() - (days - 1) * 86400000);
  const { daily, sleep, workouts } = await HealthBridge.readAll({
    startDate: ymd(start),
    endDate: ymd(end),
  });

  const result: WearableSyncResult = { daily: 0, sleep: 0, workouts: 0 };

  if (daily.length) {
    const rows = daily.map((d) => ({ ...d, source }));
    const { data, error } = await supabase.rpc('upsert_wearable_daily', {
      p_user_id: userId,
      p_rows: rows,
    });
    if (error) throw new Error(`upsert_daily: ${error.message}`);
    result.daily = (data as number) ?? rows.length;
  }

  if (sleep.length) {
    const rows = sleep.map((s) => ({ ...s, source }));
    const { data, error } = await supabase.rpc('upsert_wearable_sleep', {
      p_user_id: userId,
      p_rows: rows,
    });
    if (error) throw new Error(`upsert_sleep: ${error.message}`);
    result.sleep = (data as number) ?? rows.length;
  }

  if (workouts.length) {
    const rows = workouts.map((w) => ({ ...w, source }));
    const { data, error } = await supabase.rpc('import_wearable_workouts', {
      p_user_id: userId,
      p_rows: rows,
    });
    if (error) throw new Error(`import_workouts: ${error.message}`);
    result.workouts = (data as number) ?? rows.length;
  }

  // Marca/actualiza la conexión del agregador.
  await supabase.from('wearable_connections').upsert(
    {
      user_id: userId,
      provider: source,
      status: 'connected',
      last_sync_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  );

  return result;
}
