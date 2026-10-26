import { openDB, type IDBPDatabase } from 'idb';
import type { Persister, PersistedClient } from '@tanstack/react-query-persist-client';

const DB_NAME = 'gymlog-rq';
const STORE = 'cache';
const KEY = 'client';

/**
 * Apertura perezosa.
 *
 * Antes se abría al importar el módulo. Eso hacía que cualquier import —un
 * test, una ruta que solo quería borrar la caché al cerrar sesión— reventara en
 * un entorno sin `indexedDB`, y convertía un import en una operación de disco.
 * Ahora se abre en la primera lectura o escritura y se vuelve a intentar si
 * falla.
 */
let dbPromise: Promise<IDBPDatabase> | null = null;

function indexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE);
      },
    }).catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

/**
 * Persister de TanStack Query respaldado por IndexedDB (vía idb).
 * Permite que la app muestre datos cacheados sin conexión.
 *
 * Aquí no hay agrupación de escrituras a propósito: la hace `PersistGate`
 * (`app/persistGate.tsx`), que estrangula el `dehydrate` **y** la escritura de
 * una vez. Estrangular también aquí solo añadiría latencia.
 */
export const idbPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    if (!indexedDbAvailable()) return;
    try {
      await (await getDb()).put(STORE, client, KEY);
    } catch {
      // Cuota llena o IndexedDB no disponible: la caché en memoria sigue
      // sirviendo y el siguiente guardado reintentará.
    }
  },
  restoreClient: async () => {
    if (!indexedDbAvailable()) return undefined;
    try {
      return await (await getDb()).get(STORE, KEY);
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    if (!indexedDbAvailable()) return;
    try {
      await (await getDb()).delete(STORE, KEY);
    } catch {
      // Sin IndexedDB no hay nada que borrar; no se propaga al cierre de sesión.
    }
  },
};
