// Modalidad de carga de un ejercicio. Fuente única de verdad para el tipo y los
// helpers derivados. Persiste en `exercises.load_type` (ver migración
// 20260720120000_exercise_load_type.sql).
//
//   - external           → carga externa (barra, mancuerna, máquina). El kg = peso levantado.
//   - bodyweight         → peso corporal puro. El kg (opcional) = lastre.
//   - bodyweight_loaded  → peso corporal + lastre. El kg = lastre (habitual).
//
// Las dos variantes de peso corporal comparten la lógica de volumen: el peso
// guardado es (peso corporal vigente + lastre). Solo cambia la presentación.

export type LoadType = 'external' | 'bodyweight' | 'bodyweight_loaded';

export const LOAD_TYPES: readonly LoadType[] = [
  'external',
  'bodyweight',
  'bodyweight_loaded',
] as const;

/** ¿La modalidad usa el peso corporal como base (con lastre opcional)? */
export function isBodyweightLoad(loadType: string | null | undefined): boolean {
  return loadType === 'bodyweight' || loadType === 'bodyweight_loaded';
}

/**
 * ¿La serie solo consta si se escribe un peso?
 *
 * Sí únicamente cuando el catálogo dice **carga externa**. Que el ejercicio no
 * esté en la biblioteca (una plantilla que usa un nombre todavía sin ficha, o un
 * ejercicio escrito a mano) no es lo mismo que saber que lleva kilos: ahí no hay
 * nada que pedir y darlo por externo dejaba la rutina imposible de terminar con
 * el plan entero delante.
 */
export function pideCargaExterna(loadType: string | null | undefined): boolean {
  return loadType === 'external';
}

/** Modalidad por defecto a partir del equipamiento de ExerciseDB. */
export function loadTypeFromEquipment(equipment: readonly string[]): LoadType {
  return equipment.some((e) => /body\s*weight/i.test(e)) ? 'bodyweight' : 'external';
}
