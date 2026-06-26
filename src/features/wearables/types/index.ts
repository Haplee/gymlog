// Tipos de la feature wearables. Las tablas nuevas (wearable_*) aún no están en
// src/types/database.types.ts (se regenerará con gen:types tras aplicar la
// migración); aquí declaramos las formas que consume el cliente.

export type WearableProvider = 'fitbit' | 'health_connect' | 'healthkit';

export interface WearableConnection {
  id: string;
  user_id: string;
  provider: WearableProvider;
  status: 'connected' | 'disconnected' | 'error';
  scopes: string[];
  fitbit_user_id: string | null;
  access_expires_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface WearableDaily {
  id: string;
  user_id: string;
  date: string;
  source: WearableProvider;
  steps: number | null;
  distance_km: number | null;
  calories: number | null;
  resting_hr: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  created_at: string;
}

export interface WearableSleep {
  id: string;
  user_id: string;
  date: string;
  source: WearableProvider;
  duration_min: number | null;
  deep_min: number | null;
  light_min: number | null;
  rem_min: number | null;
  awake_min: number | null;
  efficiency_pct: number | null;
  created_at: string;
}

export interface WearableSyncResult {
  daily: number;
  sleep: number;
  workouts: number;
}
