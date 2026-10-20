// Pesos propuestos al empezar una sesión desde la rutina. Vivía dentro de un
// `useCallback` de RoutinePage; aquí es una función pura —el store de
// progresión entra como argumento— y se puede probar sin montar la pantalla.
import type { RoutineExercise } from '@features/routine/stores/routineStore';
import type { Exercise, WorkoutSetWithDetails } from '@shared/lib/types';
import { isBodyweightLoad } from '@shared/lib/loadType';
import { normalizeExerciseName } from '@shared/lib/progressionCycle';
import { weightToInput } from '@shared/lib/weight';

/**
 * Precarga en cada ejercicio el peso que sugiere el ciclo de progresión (carga
 * de trabajo actual, con la reducción de descarga si toca). Sin ciclo todavía,
 * usa el último peso registrado de la última sesión.
 *
 * En peso corporal no se rellena carga: solo las reps, que ya van de la
 * plantilla. Por eso se descarta el ejercicio entero y no solo se deja el valor
 * fuera.
 *
 * @param prefillWeightFor la consulta al ciclo de progresión; se pasa como
 *   función para que el cálculo no dependa de ningún store.
 */
export function buildExercisePrefills(
  dayExercises: readonly RoutineExercise[],
  recentSets: readonly WorkoutSetWithDetails[],
  catalog: readonly Exercise[],
  weightUnit: 'kg' | 'lb',
  prefillWeightFor: (name: string, lastTopWeight: number | null) => number | null,
): Record<string, string> {
  const prefills: Record<string, string> = {};

  // Con solo recorrer las series recientes en orden se saca el último peso
  // usado de cada ejercicio: la primera que aparece por nombre es la más nueva.
  const lastByExercise = new Map<string, number>();
  for (const s of recentSets) {
    const name = s.exercise?.name;
    if (!name || s.is_warmup || !Number.isFinite(s.weight) || s.weight <= 0) continue;
    const key = normalizeExerciseName(name);
    if (!lastByExercise.has(key)) lastByExercise.set(key, s.weight);
  }

  const catalogByName = new Map(catalog.map((e) => [normalizeExerciseName(e.name), e]));

  for (const ex of dayExercises) {
    const key = normalizeExerciseName(ex.name);
    const isBodyweight = isBodyweightLoad(catalogByName.get(key)?.load_type);
    if (isBodyweight) continue;
    const weight = prefillWeightFor(ex.name, lastByExercise.get(key) ?? null);
    if (weight === null || weight <= 0) continue;
    prefills[key] = weightToInput(weight, weightUnit);
  }

  return prefills;
}
