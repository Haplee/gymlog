import { supabase } from '@shared/lib/supabase';
import type { WearableConnection, WearableDaily, WearableSleep } from '../types';

// Claves de query (patrón del proyecto: ['nombre', userId])
export const WEARABLE_CONNECTIONS_KEY = (userId: string) => ['wearableConnections', userId];
export const WEARABLE_DAILY_KEY = (userId: string) => ['wearableDaily', userId];
export const WEARABLE_SLEEP_KEY = (userId: string) => ['wearableSleep', userId];

export async function fetchWearableConnections(userId: string): Promise<WearableConnection[]> {
  const { data, error } = await supabase
    .from('wearable_connections')
    .select(
      'id, user_id, provider, status, scopes, fitbit_user_id, access_expires_at, last_sync_at, last_error, created_at, updated_at',
    )
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as WearableConnection[];
}

export async function fetchWearableDaily(userId: string, limit = 30): Promise<WearableDaily[]> {
  const { data, error } = await supabase
    .from('wearable_daily')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as WearableDaily[];
}

export async function fetchWearableSleep(userId: string, limit = 30): Promise<WearableSleep[]> {
  const { data, error } = await supabase
    .from('wearable_sleep')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as WearableSleep[];
}
