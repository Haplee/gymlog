// Raíz de composición del cierre de sesión.
//
// Este es el único sitio del código que sabe a la vez qué features existen y
// qué tiene que pasar al cerrar sesión. Vive en `app/` a propósito: la capa de
// aplicación puede conocer a las features, pero una feature (`auth`) no debe
// conocer a las demás. Antes `authStore` importaba `workoutStore` y
// `routineStore` directamente, y eso cerraba dos ciclos en tiempo de ejecución.
//
// Se importa desde `main.tsx` sin condiciones. Es importante que sea así y no
// un registro perezoso dentro de cada store: las rutas se cargan con `lazy()`,
// así que un usuario que nunca hubiera abierto /routines no tendría registrado
// el respaldo de rutinas y lo perdería al cerrar sesión sin enterarse.

import { registerSignOutTask } from '@shared/lib/sessionLifecycle';
import { unregisterPushToken } from '@shared/lib/push';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { useProgressionStore } from '@features/routine/stores/progressionStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';

/**
 * Respaldo de rutinas. Va en `pre-signout` porque es el último momento con
 * credenciales válidas, y cubre el caso de que el storage se haya limpiado
 * entre dos ventanas de `checkAndBackup`.
 */
registerSignOutTask({
  phase: 'pre-signout',
  name: 'routine:backup',
  requiresUser: true,
  // `saveToDb` devuelve un boolean de éxito que aquí no se consulta: el
  // registro ya trata cualquier fallo como best-effort.
  run: async (userId) => {
    await useRoutineStore.getState().saveToDb(userId as string);
  },
});

/**
 * Respaldo de la progresión automática: sube las últimas sesiones registradas
 * y el estado del ciclo (carga, contador de descarga) antes de perder las
 * credenciales. Best-effort, igual que el de rutinas.
 */
registerSignOutTask({
  phase: 'pre-signout',
  name: 'progression:backup',
  requiresUser: true,
  run: async (userId) => {
    await useProgressionStore.getState().saveToDb(userId as string);
  },
});

/** Borrado local del entrenamiento en curso: no necesita sesión. */
registerSignOutTask({
  phase: 'cleanup',
  name: 'workout:clearPersistedState',
  run: () => useWorkoutStore.getState().clearPersistedState(),
});

/**
 * Token push del dispositivo. Va en `pre-signout` porque la fila se borra en el
 * servidor y hace falta la sesión. Antes solo se limpiaba al apagar el toggle
 * de notificaciones: quien cerraba sesión dejaba su token vivo y podía seguir
 * recibiendo avisos de una cuenta a la que ya no entra.
 */
registerSignOutTask({
  phase: 'pre-signout',
  name: 'push:unregister',
  requiresUser: true,
  run: async (userId) => {
    await unregisterPushToken(userId ?? undefined);
  },
});

/**
 * Caché persistida de TanStack Query (IndexedDB). Contiene entrenos, medidas y
 * salud: es la copia offline de la cuenta. `queryClient.clear()` vacía la
 * memoria, pero no el disco; sin esto, los datos seguían ahí después de salir.
 */
registerSignOutTask({
  phase: 'cleanup',
  name: 'cache:clearPersistedQueries',
  run: async () => {
    // Import dinámico: `queryPersister` abre IndexedDB al cargarse y este
    // módulo se importa en contextos sin `indexedDB` (tests, arranque en frío).
    const { idbPersister } = await import('@app/queryPersister');
    await idbPersister.removeClient();
  },
});

/**
 * Cachés del service worker (solo web). Guardan respuestas de la API y el
 * bundle; se borran al cerrar sesión para que el siguiente usuario del mismo
 * dispositivo no herede nada. En nativo no hay SW registrado y `caches` no
 * existe.
 */
registerSignOutTask({
  phase: 'cleanup',
  name: 'cache:clearServiceWorker',
  run: async () => {
    if (typeof caches === 'undefined') return;
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  },
});
