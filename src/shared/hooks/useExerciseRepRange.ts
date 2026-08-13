import { useMemo } from 'react';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { resolveExerciseRepRange, type RepRange } from '@shared/lib/exerciseTargets';

/**
 * Rango de reps objetivo del ejercicio, resuelto desde la rutina activa.
 *
 * Es el único punto por el que las pantallas obtienen este dato, para que la
 * sugerencia de carga sea la misma en todas. Quien ya conozca el objetivo
 * —la sesión de rutina sabe de qué día viene cada ejercicio— lo pasa en
 * `explicitTargetReps` y se salta la búsqueda.
 */
export function useExerciseRepRange(
  exerciseName: string | null | undefined,
  explicitTargetReps?: string,
): RepRange {
  // Los getters del store leen con get(): hay que suscribirse a lo que los hace
  // cambiar para no quedarse con una rutina obsoleta (mismo motivo que en
  // WorkoutPage con `routines` y `activeRoutineId`).
  const routines = useRoutineStore((s) => s.routines);
  const activeRoutineId = useRoutineStore((s) => s.activeRoutineId);

  const routine = useMemo(
    () => routines.find((r) => r.id === activeRoutineId) ?? null,
    [routines, activeRoutineId],
  );

  // Objeto memoizado: se pasa a `useExerciseAdvice`, que lo usa en deps.
  return useMemo(
    () => resolveExerciseRepRange(exerciseName, routine, explicitTargetReps),
    [exerciseName, routine, explicitTargetReps],
  );
}
