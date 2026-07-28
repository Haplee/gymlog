// Registro de tareas de cierre de sesión.
//
// Por qué existe: `authStore.signOut` necesitaba tocar el estado de otras
// features (respaldar rutinas, borrar el estado persistido de workout), y lo
// hacía importándolas directamente. Eso creaba dependencias circulares en
// tiempo de ejecución — `auth → workout → auth` y `auth → routine → auth` —
// entre stores de Zustand, que es el peor sitio para tenerlas: el orden de
// inicialización de módulos deja de ser predecible.
//
// Aquí la dependencia se invierte. Este módulo no conoce a nadie; las features
// se registran y `authStore` solo recorre el registro.
//
// El registro NO se puebla solo: lo hace `src/app/sessionTasks.ts`, que es la
// raíz de composición. Es deliberado — si cada store se registrase al
// importarse, una feature que aún no se hubiera cargado (las rutas van con
// `lazy()`) no tendría su tarea registrada y el logout la saltaría en silencio.

import { devError } from './devtools';

/**
 * `pre-signout` corre con la sesión todavía viva: es el único momento en el que
 * quedan credenciales válidas para escribir en el servidor.
 * `cleanup` corre después, para borrados locales que no necesitan sesión.
 */
export type SignOutPhase = 'pre-signout' | 'cleanup';

export interface SignOutTask {
  phase: SignOutPhase;
  /** Identifica la tarea en los logs cuando falla. */
  name: string;
  /** Si es `true`, se salta cuando no hay usuario en sesión. */
  requiresUser?: boolean;
  run: (userId: string | null) => void | Promise<void>;
}

const tasks: SignOutTask[] = [];

export function registerSignOutTask(task: SignOutTask): void {
  tasks.push(task);
}

/**
 * Ejecuta las tareas de una fase en el orden en que se registraron.
 *
 * Todas son best-effort a propósito: un fallo se registra y se sigue. Dejar a
 * alguien con la sesión a medio cerrar porque un respaldo no pudo subir es peor
 * que perder ese respaldo.
 */
export async function runSignOutPhase(phase: SignOutPhase, userId: string | null): Promise<void> {
  for (const task of tasks) {
    if (task.phase !== phase) continue;
    if (task.requiresUser && !userId) continue;
    try {
      await task.run(userId);
    } catch (err) {
      devError(`[GymLog] Tarea de signOut «${task.name}» falló:`, err);
    }
  }
}

/** Solo para tests: deja el registro vacío entre casos. */
export function resetSignOutTasks(): void {
  tasks.length = 0;
}
