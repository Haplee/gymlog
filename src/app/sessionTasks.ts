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
import { useRoutineStore } from '@features/routine/stores/routineStore';
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

/** Borrado local del entrenamiento en curso: no necesita sesión. */
registerSignOutTask({
  phase: 'cleanup',
  name: 'workout:clearPersistedState',
  run: () => useWorkoutStore.getState().clearPersistedState(),
});
