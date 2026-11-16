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
  name: 'user:clearLocalData',
  run: async (userId) => {
    // Import dinámico: este módulo se carga en el arranque y en tests sin
    // `indexedDB`; la limpieza real solo hace falta cuando hay un cierre.
    const { clearLocalUserData } = await import('@app/userDataCleanup');
    await clearLocalUserData({ userId, clearOutbox: false });
  },
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
 * Caché persistida de TanStack Query (IndexedDB), memoria de consultas y
 * cachés del service worker. Todo eso lo borra `user:clearLocalData`; se deja
 * aquí la explicación para que no vuelva a añadirse una tarea suelta que solo
 * cubra una de las tres.
 */
