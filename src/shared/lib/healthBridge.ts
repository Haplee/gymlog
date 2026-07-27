import { registerPlugin } from '@capacitor/core';

// Puente único a los agregadores de salud nativos:
//   - Android  -> Health Connect (HealthBridgePlugin.kt)
//   - iOS      -> Apple HealthKit (HealthBridgePlugin.swift)
// Devuelven el MISMO modelo normalizado; el origen ('health_connect'|'healthkit')
// lo decide el llamador según la plataforma. Por estos agregadores entran también
// los datos de Amazfit (vía app Zepp), Samsung, Garmin, Apple Watch, etc.

export interface HealthDailyRow {
  date: string; // YYYY-MM-DD
  steps?: number;
  distance_km?: number;
  calories?: number;
  resting_hr?: number;
  avg_hr?: number;
  max_hr?: number;
}

export interface HealthSleepRow {
  date: string;
  duration_min?: number;
  deep_min?: number;
  light_min?: number;
  rem_min?: number;
  awake_min?: number;
}

export interface HealthWorkoutRow {
  external_id: string;
  type: string;
  started_at: string; // ISO
  duration: number; // segundos
  distance?: number; // km
  calories?: number;
  avg_hr?: number;
  max_hr?: number;
}

export interface HealthReadResult {
  daily: HealthDailyRow[];
  sleep: HealthSleepRow[];
  workouts: HealthWorkoutRow[];
  /** Sesiones de fuerza detectadas (Health Connect/HealthKit) que NO se
   * importan: no traen ejercicios/series/pesos, así que no se pueden
   * reconstruir como entrenamiento de GymLog. */
  skippedStrength: number;
}

export interface HealthBridgePlugin {
  /** ¿Hay agregador de salud disponible en este dispositivo? */
  isAvailable(): Promise<{ available: boolean }>;
  /** ¿Están concedidos ya los permisos de lectura? (sin lanzar la UI de permisos).
   * En Android es fiable; en iOS es best-effort (HealthKit oculta el estado de
   * lectura por privacidad y solo indica si el flujo de permisos ya se recorrió). */
  hasPermissions(): Promise<{ granted: boolean }>;
  /** Solicita permisos de lectura (pasos, HR, sueño, ejercicio). */
  requestAuthorization(): Promise<{ granted: boolean }>;
  /** Lee datos en el rango [startDate, endDate] (ISO YYYY-MM-DD). */
  readAll(options: { startDate: string; endDate: string }): Promise<HealthReadResult>;
}

const HealthBridge = registerPlugin<HealthBridgePlugin>('HealthBridge', {
  // Fallback web/PWA: no hay capa nativa, evita UNIMPLEMENTED.
  web: () => ({
    isAvailable: async () => ({ available: false }),
    hasPermissions: async () => ({ granted: false }),
    requestAuthorization: async () => ({ granted: false }),
    readAll: async () => ({ daily: [], sleep: [], workouts: [], skippedStrength: 0 }),
  }),
});

export default HealthBridge;
