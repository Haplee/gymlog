import { Capacitor } from '@capacitor/core';
import HealthBridge from '@shared/lib/healthBridge';
import { supabase } from '@shared/lib/supabase';
import { devError } from '@shared/lib/devtools';
import type { WearableProvider, WearableSyncResult } from '../types';

// Códigos de error estandarizados (deben coincidir con HealthConnectError en Kotlin/TS)
export type HealthConnectErrorCode =
  | 'NOT_AVAILABLE'
  | 'PROVIDER_UPDATE_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'FEATURE_UNAVAILABLE'
  | 'INVALID_TIME_RANGE'
  | 'SYNC_INTERRUPTED'
  | 'READ_FAILED'
  | 'UNKNOWN_ERROR';

/**
 * Registra un evento de auditoría en health_connect_audit.
 * Resiliente: falla en silencio (try/catch) para no romper el sync del usuario.
 * No guarda PHI: ni valores fisiológicos, ni timestamps con dato, ni IDs externos.
 */
export async function logHealthConnectAudit(
  userId: string,
  eventType:
    | 'permission_granted'
    | 'permission_revoked'
    | 'sync_start'
    | 'sync_complete'
    | 'sync_error'
    | 'disconnect',
  opts: {
    recordTypes?: string[];
    recordCount?: number;
    errorCode?: HealthConnectErrorCode;
  } = {},
): Promise<void> {
  try {
    await supabase.from('health_connect_audit').insert({
      user_id: userId,
      event_type: eventType,
      record_types: opts.recordTypes ?? [],
      record_count: opts.recordCount ?? 0,
      error_code: opts.errorCode ?? null,
    });
  } catch (e) {
    // Auditoría no crítica: log y continúa
    devError('[HealthAggregator] audit insert failed:', e);
  }
}

// Sincroniza desde el agregador de salud nativo (Health Connect / HealthKit).
// Por aquí entran Amazfit (vía Zepp), Samsung, Garmin, Apple Watch, etc.
// Lee con el plugin nativo y upserta en Supabase como el usuario (RLS aplica).

/**
 * Mapea los errores devueltos por el plugin nativo (en el array `errors`)
 * a códigos de error estandarizados (HealthConnectErrorCode).
 * El plugin nativo devuelve strings como "sleep: SecurityException: ...".
 */
function mapNativeErrorsToCode(errors: string[]): HealthConnectErrorCode | null {
  const joined = errors.join(' ').toLowerCase();
  if (joined.includes('securityexception') || joined.includes('permission')) {
    if (
      joined.includes('read_health_data_in_background') ||
      joined.includes('maybeenforceonlycallingpackagedatarequested')
    ) {
      return 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }
  if (
    joined.includes('sdk') ||
    joined.includes('provider') ||
    joined.includes('not available') ||
    joined.includes('unavailable')
  ) {
    return 'NOT_AVAILABLE';
  }
  if (joined.includes('provider update') || joined.includes('update required')) {
    return 'PROVIDER_UPDATE_REQUIRED';
  }
  if (joined.includes('feature') || joined.includes('unsupported')) {
    return 'FEATURE_UNAVAILABLE';
  }
  if (joined.includes('time range') || joined.includes('timerangefilter')) {
    return 'INVALID_TIME_RANGE';
  }
  if (joined.includes('interrupt') || joined.includes('cancel')) {
    return 'SYNC_INTERRUPTED';
  }
  if (joined.includes('read') || joined.includes('failed') || joined.includes('error')) {
    return 'READ_FAILED';
  }
  return null;
}

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

  // Auditoría: sync_start
  await logHealthConnectAudit(userId, 'sync_start', { recordTypes: [] });

  try {
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

    // Convertir errores del plugin nativo a códigos estandarizados para auditoría y UI
    const nativeErrorCode = mapNativeErrorsToCode(errors ?? []);
    if (nativeErrorCode) {
      // Auditoría: sync_error con código específico
      await logHealthConnectAudit(userId, 'sync_error', {
        recordTypes: [],
        recordCount: 0,
        errorCode: nativeErrorCode,
      });
      // Lanzar error tipado para que la UI muestre el toast específico
      throw new Error(nativeErrorCode);
    }

    // Una sección que falla ya no vacía las demás, pero tampoco puede pasar
    // desapercibida: sin esto, un permiso revocado se veía como "no hay datos".
    if (errors?.length) devError('[HealthAggregator] lecturas fallidas:', errors);

    const result: WearableSyncResult = { daily: 0, sleep: 0, workouts: 0, strength: 0 };

    // Determinar record_types que se han procesado (para auditoría sin PHI)
    const processedRecordTypes: string[] = [];
    if (daily.length)
      processedRecordTypes.push(
        'resting_heart_rate',
        'steps',
        'distance',
        'calories',
        'heart_rate',
      );
    if (sleep.length) processedRecordTypes.push('sleep');
    if (workouts.length) processedRecordTypes.push('exercise');
    if (strengthSessions.length) processedRecordTypes.push('strength_session');

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

    // Auditoría: sync_complete
    await logHealthConnectAudit(userId, 'sync_complete', {
      recordTypes: processedRecordTypes,
      recordCount: result.daily + result.sleep + result.workouts + result.strength,
    });

    return result;
  } catch (e) {
    // Auditoría: sync_error (sin PHI)
    const errorCode =
      e instanceof Error && e.message === 'no_permission' ? 'PERMISSION_DENIED' : 'UNKNOWN_ERROR';
    await logHealthConnectAudit(userId, 'sync_error', {
      recordTypes: [],
      recordCount: 0,
      errorCode,
    });
    throw e;
  }
}
