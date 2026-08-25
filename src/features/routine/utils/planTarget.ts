/**
 * Cómo se lee y cómo se pinta el objetivo de un ejercicio del plan.
 *
 * Vive aparte de `routineStore` porque los mismos tres campos viajan en tres
 * formas distintas —el `RoutineExercise` del store, el `SharedExercise` de un
 * fichero compartido y la fila que se imprime— y las tres tienen que decidir lo
 * mismo. Con la lógica repartida bastaría que una tratase el `undefined` de otra
 * manera para que una rutina vieja se leyera mal en un sitio y bien en otro.
 *
 * Es estructural a propósito: no importa de qué tipo venga el objeto mientras
 * tenga los campos.
 */

import { modeOfPlanned } from '@shared/lib/setShape';

/** Lo mínimo de un ejercicio planificado para saber qué se pide. */
export interface PlannedExerciseShape {
  sets?: number;
  reps?: string;
  mode?: string | null;
  perSide?: boolean;
  durationSeconds?: number;
}

/**
 * Modo de un ejercicio **del plan**: solo `reps` o `time`.
 *
 * `modeOfPlanned` admite además `cardio` porque la usan sitios que sí registran
 * cardio. Una rutina no: si un fichero manipulado trae `mode: 'cardio'`, aquí
 * cae en `reps` en vez de crear un ejercicio que ninguna pantalla sabe pintar.
 */
export function planModeOf(ex: PlannedExerciseShape | null | undefined): 'reps' | 'time' {
  return modeOfPlanned(ex) === 'time' ? 'time' : 'reps';
}

/** Duración mínima y máxima admitidas para una serie por tiempo, en segundos. */
export const MIN_DURACION_SEGUNDOS = 1;
export const MAX_DURACION_SEGUNDOS = 3600;

/**
 * Duración válida de la serie, o `null` si el ejercicio no se mide en tiempo o
 * el número no sirve.
 *
 * Devuelve `null` y no `0` por lo mismo que `setShape`: cero segundos es un
 * dato («aguanté cero»), y no es lo que significa un campo vacío.
 */
export function planDurationOf(ex: PlannedExerciseShape | null | undefined): number | null {
  if (planModeOf(ex) !== 'time') return null;
  const s = ex?.durationSeconds;
  if (typeof s !== 'number' || !Number.isFinite(s)) return null;
  const entero = Math.floor(s);
  if (entero < MIN_DURACION_SEGUNDOS || entero > MAX_DURACION_SEGUNDOS) return null;
  return entero;
}

/**
 * Segundos en lo que se lee de un vistazo entre serie y serie.
 *
 * Por debajo del minuto, «45 s»: escribir «0:45» obliga a leer dos números para
 * entender uno. A partir del minuto, `m:ss`, que es como se cuenta una plancha.
 */
export function formatSegundos(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  if (total < 60) return `${total} s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* --------------------------------------------------------- superseries ---- */

/** Un tramo de la lista de ejercicios: suelto, o un grupo encadenado. */
export interface PlanGroup<T> {
  /** `null` en un ejercicio suelto. */
  supersetId: string | null;
  /** Índices en la lista original. Se conservan para poder editar en su sitio. */
  indices: number[];
  exercises: T[];
}

/**
 * Parte la lista de ejercicios del día en tramos: sueltos y superseries.
 *
 * **Solo agrupa ejercicios consecutivos.** Dos ejercicios con el mismo
 * `supersetId` separados por un tercero no forman una superserie: forman dos
 * grupos de uno. Es lo que hace que reordenar la lista rompa el encadenado en
 * vez de dejar una superserie que salta por encima de otro ejercicio, que es lo
 * que el usuario acaba de decir que no quiere al mover la fila.
 */
export function groupPlanExercises<T extends { supersetId?: string }>(
  exercises: readonly T[],
): PlanGroup<T>[] {
  const grupos: PlanGroup<T>[] = [];

  exercises.forEach((ex, i) => {
    const id = ex.supersetId ?? null;
    const ultimo = grupos[grupos.length - 1];
    if (id !== null && ultimo && ultimo.supersetId === id) {
      ultimo.indices.push(i);
      ultimo.exercises.push(ex);
      return;
    }
    grupos.push({ supersetId: id, indices: [i], exercises: [ex] });
  });

  return grupos;
}

/**
 * Orden de ejecución de una superserie: serie 1 de A, serie 1 de B, serie 2 de
 * A, serie 2 de B…
 *
 * Devuelve pares `[índiceDeEjercicio, númeroDeSerie]` con el número de serie
 * empezando en 1. Se calcula aquí y no en la pantalla para poder probarlo sin
 * montar nada.
 */
export function supersetOrder(setsPorEjercicio: readonly number[]): [number, number][] {
  const vueltas = Math.max(0, ...setsPorEjercicio);
  const orden: [number, number][] = [];
  for (let vuelta = 0; vuelta < vueltas; vuelta++) {
    setsPorEjercicio.forEach((n, ejercicio) => {
      // Un ejercicio con menos series que el resto **sale del ciclo** cuando se
      // le acaban, en vez de bloquear la vuelta: un 4×A + 3×B es una superserie
      // perfectamente normal y la cuarta vuelta es solo A.
      if (vuelta < n) orden.push([ejercicio, vuelta + 1]);
    });
  }
  return orden;
}
