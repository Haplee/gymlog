import { openDB } from 'idb';
import type { Persister, PersistedClient } from '@tanstack/react-query-persist-client';

const DB_NAME = 'gymlog-rq';
const STORE = 'cache';
const KEY = 'client';

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE);
  },
});

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
    try {
      (await dbPromise).put(STORE, client, KEY);
    } catch {
      // Cuota llena o IndexedDB no disponible: la caché en memoria sigue
      // sirviendo y el siguiente guardado reintentará.
    }
  },
  restoreClient: async () => {
    return (await dbPromise).get(STORE, KEY);
  },
  removeClient: async () => {
    (await dbPromise).delete(STORE, KEY);
  },
};
