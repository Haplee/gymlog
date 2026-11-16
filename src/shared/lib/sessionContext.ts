/**
 * Contexto de la sesión en curso: qué ejercicio va en qué orden y cuánto se le
 * ha hecho antes al mismo grupo muscular.
 *
 * Es la entrada de la fatiga intra-sesión: un press banca que va cuarto, detrás
 * de seis series de espalda, no llega al pecho como el primero de la mañana.
 */

export interface SessionExercise {
  name: string;
  muscleGroup?: string;
  sets: number;
}

export function getPriorSetsSameMuscle(
  exerciseOrder: number,
  sessionExercises: SessionExercise[],
): number {
  if (exerciseOrder <= 1) return 0;
  const current = sessionExercises[exerciseOrder - 1];
  if (!current?.muscleGroup) return 0;

  let total = 0;
  for (let i = 0; i < exerciseOrder - 1; i++) {
    const ex = sessionExercises[i];
    if (ex.muscleGroup === current.muscleGroup) total += ex.sets;
  }
  return total;
}
