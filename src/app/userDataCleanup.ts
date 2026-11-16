// Borrado de los datos de una cuenta en este dispositivo.
//
// Vive en `app/` porque es la raíz de composición: conoce a todas las features
// que guardan estado de usuario y puede resetearlas sin que `auth` (o `privacy`)
// tengan que importarlas. Los stores no se conocen entre sí y ninguno importa
// este módulo, así que no hay ciclos.
//
// Qué NO borra: las preferencias del dispositivo (tema, idioma, acento, pasos
// de carga, etc.). Son de quien usa el móvil, no de la cuenta, y perderlas al
// cerrar sesión sería una regresión de producto.
//
// Qué hace con la cola offline: **no la borra**. Un entreno que aún no ha
// llegado al servidor no debe desaparecer porque alguien cierre sesión. Se
// conserva asociado a su `userId` (ver `workoutOutbox`), no se procesa desde
// otra cuenta y el usuario puede descartarla explícitamente desde Privacidad.

import { devError } from '@shared/lib/devtools';
import { queryClient } from './queryClient';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { useWorkTimerStore } from '@features/workout/stores/workTimerStore';
import { useRestTimerStore } from '@features/workout/stores/restTimerStore';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { useProgressionStore } from '@features/routine/stores/progressionStore';
import { useRoutineSessionStore } from '@features/routine/stores/routineSessionStore';
import { useCardioStore } from '@features/cardio/stores/cardioStore';
import { useCoachStore } from '@features/coach/stores/coachStore';
import { useWearableStore } from '@features/wearables/stores/wearableStore';
import { useNotificationsStore } from '@shared/stores/notificationsStore';
import { useOutboxStore } from '@shared/stores/outboxStore';
import { clearOutboxForUser } from '@shared/lib/workoutOutbox';

/**
 * Claves de `localStorage` que contienen datos de la cuenta.
 *
 * Lista explícita y no un prefijo `gymlog-`: `gymlog-settings` es del
 * dispositivo y no debe caer con ella. Si algún día se añade otro store
 * persistido de usuario, tiene que entrar aquí.
 */
export const USER_SCOPED_STORAGE_KEYS = [
  'gymlog-workout',
  'gymlog-routines',
  'gymlog-progression',
  'gymlog-cardio',
  'gymlog-routine-session',
  'gymlog-coach',
  'gymlog-wearables',
  'gymlog-work-timer',
  'gymlog-rest-timer',
  'gymlog-notifications',
] as const;

/** Prefijo de los consentimientos de salud, que llevan el id de usuario. */
const HEALTH_CONSENT_PREFIX = 'gymlog-health-consent-v1:';

/**
 * Última cuenta que usó este dispositivo. Sirve para detectar, al arrancar,
 * que el storage tiene datos de otra persona aunque el cierre de sesión no
 * llegara a completarse (app cerrada a la fuerza, token revocado en otro
 * sitio). Sin esta marca, la única comprobación posible sería «¿hay usuario?»,
 * y los stores persistidos no guardan a quién pertenecen.
 */
const OWNER_KEY = 'gymlog-data-owner';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readDataOwner(): string | null {
  return storage()?.getItem(OWNER_KEY) ?? null;
}

export function writeDataOwner(userId: string | null): void {
  const store = storage();
  if (!store) return;
  if (userId) store.setItem(OWNER_KEY, userId);
  else store.removeItem(OWNER_KEY);
}

/**
 * Devuelve cada store a su estado inicial. No toca `localStorage`: el
 * `persist` de Zustand ya escribe el estado vacío, y las claves se eliminan
 * después por si alguna escritura quedó pendiente.
 */
export function resetUserScopedStores(): void {
  const resets: Array<[string, () => void]> = [
    ['workout', () => useWorkoutStore.getState().clearPersistedState()],
    ['routine', () => useRoutineStore.getState().clearLocal()],
    ['progression', () => useProgressionStore.getState().reset()],
    ['routine-session', () => useRoutineSessionStore.getState().discard()],
    ['cardio', () => useCardioStore.getState().clearLocal()],
    ['coach', () => useCoachStore.getState().clearLocal()],
    ['wearables', () => useWearableStore.getState().clearLocal()],
    ['notifications', () => useNotificationsStore.getState().clear()],
    ['work-timer', () => useWorkTimerStore.getState().reset()],
    ['rest-timer', () => useRestTimerStore.getState().stop()],
    ['outbox-counter', () => useOutboxStore.getState().reset()],
  ];

  for (const [name, run] of resets) {
    try {
      run();
    } catch (err) {
      // Un store que no se pueda resetear no debe impedir limpiar los demás.
      devError(`[userDataCleanup] no se pudo resetear «${name}»:`, err);
    }
  }
}

/** Elimina las claves persistidas y los consentimientos de salud locales. */
export function removeUserScopedStorage(): void {
  const store = storage();
  if (!store) return;
  for (const key of USER_SCOPED_STORAGE_KEYS) store.removeItem(key);
  const healthKeys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith(HEALTH_CONSENT_PREFIX)) healthKeys.push(key);
  }
  for (const key of healthKeys) store.removeItem(key);
}

/**
 * Vacía la caché de consultas en memoria, su copia en IndexedDB y las cachés
 * del service worker (solo web). Devuelve los fallos en vez de lanzar: el
 * cierre de sesión tiene que continuar aunque el navegador niegue IndexedDB.
 */
export async function clearQueryAndBrowserCaches(): Promise<string[]> {
  const failures: string[] = [];

  queryClient.clear();

  try {
    const { idbPersister } = await import('@app/queryPersister');
    await idbPersister.removeClient();
  } catch (err) {
    failures.push('indexeddb');
    devError('[userDataCleanup] no se pudo borrar la caché de consultas:', err);
  }

  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (err) {
      failures.push('cache-storage');
      devError('[userDataCleanup] no se pudieron borrar las cachés del navegador:', err);
    }
  }

  return failures;
}

export interface ClearLocalOptions {
  /** Cuenta cuya cola offline se descarta. Solo si `clearOutbox` es `true`. */
  userId?: string | null;
  /**
   * Borra también los entrenos pendientes de sincronizar de esa cuenta.
   * Por defecto es `false`: cerrar sesión no debe destruir datos.
   */
  clearOutbox?: boolean;
}

/**
 * Limpia todo lo que pertenece a una cuenta en este dispositivo.
 *
 * No cierra la sesión ni borra `gymlog-auth`: eso lo decide `authStore`.
 */
export async function clearLocalUserData(options: ClearLocalOptions = {}): Promise<void> {
  resetUserScopedStores();
  removeUserScopedStorage();

  if (options.clearOutbox && options.userId) {
    try {
      await clearOutboxForUser(options.userId);
    } catch (err) {
      devError('[userDataCleanup] no se pudo vaciar la cola offline:', err);
      throw err;
    }
  }

  const failures = await clearQueryAndBrowserCaches();
  if (failures.length > 0) {
    throw new Error(`No se pudo limpiar: ${failures.join(', ')}`);
  }
}

/**
 * Comprueba a quién pertenecen los datos locales antes de exponer una sesión.
 *
 * Si la cuenta cambió (o no hay cuenta y antes había una), limpia primero. Es
 * la red de seguridad para los caminos que no pasan por `signOut`: un token
 * revocado, una app cerrada a la fuerza o un login directo con otra cuenta.
 */
export async function adoptAccount(nextUserId: string | null): Promise<void> {
  const owner = readDataOwner();
  if (owner !== nextUserId) {
    await clearLocalUserData({ userId: owner, clearOutbox: false });
    writeDataOwner(nextUserId);
  }
}
