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
 */
export const idbPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    (await dbPromise).put(STORE, client, KEY);
  },
  restoreClient: async () => {
    return (await dbPromise).get(STORE, KEY);
  },
  removeClient: async () => {
    (await dbPromise).delete(STORE, KEY);
  },
};
