/**
 * Objetivo de repeticiones de un ejercicio: fuente única de verdad.
 *
 * El rango de reps no es un ajuste fino de la sugerencia de carga, es *el*
 * parámetro que la decide. Con la doble progresión (`suggestProgression`), estar
 * en el techo del rango significa subir peso y volver al suelo; estar por debajo
 * significa sumar una repetición al mismo peso. Un rango distinto da un peso
 * distinto.
 *
 * Por eso vive aquí y no en cada pantalla: la de entreno no lo pasaba y caía al
 * `[8, 12]` por defecto de `progression.ts`, mientras la sesión de rutina sí lo
 * pasaba. El mismo ejercicio recomendaba 80 kg en una pantalla y 82,5 kg en la
 * otra.
 *
 * El objetivo es de la **plantilla**, no del ejercicio: el mismo press banca va
 * a 5 repeticiones en un mesociclo y a 3 en otro. Por eso se lee de la rutina y
 * no de una columna de `exercises`.
 */

import { normalizeExerciseName, parseRepRange } from './progressionCycle';
import type { Routine } from '@features/routine/stores/routineStore';

export interface RepRange {
  /** Suelo del rango objetivo, p. ej. 8 de «8-10». */
  repMin?: number;
  /** Techo del rango objetivo, p. ej. 10 de «8-10». */
  repMax?: number;
}

/**
 * Objetivo de reps declarado en la rutina para un ejercicio, buscando por nombre
 * normalizado en todos los días.
 *
 * Las rutinas referencian ejercicios por nombre y no por id (igual que hace
 * `RoutineSession` al resolver el catálogo), así que esta es la única forma de
 * emparejarlos. Si el mismo ejercicio aparece en varios días con objetivos
 * distintos gana el primero: no hay forma de saber a qué día se refiere quien
 * está registrando series sueltas, y lo importante es que ambas pantallas
 * resuelvan lo mismo.
 */
export function findRoutineTargetReps(
  routine: Routine | null | undefined,
  exerciseName: string | null | undefined,
): string | undefined {
  if (!routine || !exerciseName?.trim()) return undefined;
  const key = normalizeExerciseName(exerciseName);

  for (const day of Object.values(routine.days)) {
    for (const exercise of day?.exercises ?? []) {
      if (normalizeExerciseName(exercise.name) === key) return exercise.reps;
    }
  }
  return undefined;
}

/**
 * Rango de reps objetivo de un ejercicio.
 *
 * `explicitTargetReps` tiene prioridad: la sesión de rutina ya sabe de qué día
 * viene cada ejercicio, y esa respuesta es mejor que buscarla por nombre.
 *
 * Sin objetivo en ninguna parte devuelve un rango vacío **a propósito**: es
 * mejor que ambas pantallas se queden sin rango (y sigan coincidiendo) a que
 * cada una invente el suyo, que es justo el bug que esto arregla.
 */
export function resolveExerciseRepRange(
  exerciseName: string | null | undefined,
  routine: Routine | null | undefined,
  explicitTargetReps?: string,
): RepRange {
  const target = explicitTargetReps ?? findRoutineTargetReps(routine, exerciseName);
  return parseRepRange(target);
}
