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

/** ¿Están ya concedidos los permisos de lectura? (no lanza la UI de permisos). */
export async function aggregatorHasPermission(): Promise<boolean> {
  try {
    const { granted } = await HealthBridge.hasPermissions();
    return granted;
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

// Fecha local YYYY-MM-DD. NO usar toISOString() (devuelve UTC): en zonas con
// offset positivo, cerca de medianoche local el día UTC va uno por detrás y el
// plugin nativo —que interpreta estos strings en hora LOCAL— dejaría fuera el
// día de hoy. Aquí construimos la fecha con los componentes locales del Date.
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Ventana de lectura. Sin memoria, una ventana fija dejaba huecos permanentes:
// si el usuario no abría la app en más días que la ventana, esos días no volvían
// a leerse nunca. Calculamos el rango desde la última sync con un solape (por si
// el wearable escribe datos con retraso), con un suelo (`days`) y un tope que
// acota el backfill y el coste por-sesión de readWorkouts.
const SYNC_OVERLAP_DAYS = 2;
const SYNC_MAX_DAYS = 30;

function windowDaysFrom(lastSyncAt: string | null | undefined, floorDays: number): number {
  if (!lastSyncAt) return SYNC_MAX_DAYS; // primer sync: backfill amplio
  const daysSince = Math.ceil((Date.now() - new Date(lastSyncAt).getTime()) / 86400000);
  return Math.min(SYNC_MAX_DAYS, Math.max(floorDays, daysSince + SYNC_OVERLAP_DAYS));
}

/** Lee del agregador nativo y upserta en Supabase. Devuelve el conteo importado. */
export async function syncAggregator(userId: string, days = 7): Promise<WearableSyncResult> {
  const source = aggregatorSource();
  if (!source) throw new Error('no_aggregator');

  // En Android el estado de permisos es fiable: si faltan, no seguimos (así no
  // marcamos la conexión como "connected" tras una lectura vacía por falta de
  // permiso). En iOS HealthKit oculta el estado de lectura, así que no bloqueamos.
  if (aggregatorSource() === 'health_connect') {
    const granted = await aggregatorHasPermission();
    if (!granted) throw new Error('no_permission');
  }

  // Rango dinámico desde la última sync de esta conexión.
  const { data: conn } = await supabase
    .from('wearable_connections')
    .select('last_sync_at')
    .eq('user_id', userId)
    .eq('provider', source)
    .maybeSingle();
  const windowDays = windowDaysFrom(conn?.last_sync_at, days);

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (windowDays - 1));
  const { daily, sleep, workouts, strengthSessions, errors } = await HealthBridge.readAll({
    startDate: ymd(start),
    endDate: ymd(end),
  });

  // Una sección que falla ya no vacía las demás, pero tampoco puede pasar
  // desapercibida: sin esto, un permiso revocado se veía como "no hay datos".
  if (errors?.length) devError('[HealthAggregator] lecturas fallidas:', errors);

  const result: WearableSyncResult = { daily: 0, sleep: 0, workouts: 0, strength: 0 };

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

  // Sesiones de gimnasio: tabla propia. No son cardio (ensuciaban las stats
  // como "otro") ni encajan 1:1 con un workout — el reloj graba una sesión por
  // visita al gimnasio y puede haber varios workouts dentro de esa ventana.
  if (strengthSessions.length) {
    const rows = strengthSessions.map((s) => ({ ...s, source }));
    const { data, error } = await supabase.rpc('import_health_sessions', {
      p_user_id: userId,
      p_rows: rows,
    });
    if (error) throw new Error(`import_health_sessions: ${error.message}`);
    result.strength = (data as number) ?? rows.length;
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
