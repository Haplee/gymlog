// Ediciones sobre el plan de días de una rutina. Vivían dentro de RoutinePage
// repartidas entre cinco handlers; se extrajeron para poder probarlas sin
// montar la pantalla y para dejar el caso de las superseries en un solo sitio.
import type { DayOfWeek, DayRoutine, RoutineExercise } from '@features/routine/stores/routineStore';

/** El mapa de días de una rutina, tal y como lo guarda el store. */
export type RoutineDays = Record<DayOfWeek, DayRoutine>;

/**
 * Añade un ejercicio al final del día.
 *
 * Devuelve un mapa nuevo en vez de mutar: `updateRoutine` compara la referencia
 * y el store se apoya en eso para decidir si hay algo que guardar.
 */
export function appendExerciseToDay(
  days: RoutineDays,
  day: DayOfWeek,
  exercise: RoutineExercise,
): RoutineDays {
  return {
    ...days,
    [day]: { ...days[day], exercises: [...days[day].exercises, exercise] },
  };
}

/** Quita el ejercicio que ocupa `index`. */
export function removeExerciseFromDay(
  days: RoutineDays,
  day: DayOfWeek,
  index: number,
): RoutineDays {
  return {
    ...days,
    [day]: { ...days[day], exercises: days[day].exercises.filter((_, i) => i !== index) },
  };
}

/** Sustituye el orden completo del día (resultado de arrastrar y soltar). */
export function reorderDayExercises(
  days: RoutineDays,
  day: DayOfWeek,
  next: RoutineExercise[],
): RoutineDays {
  return { ...days, [day]: { ...days[day], exercises: next } };
}

/**
 * Reemplaza el ejercicio de `index` por su versión editada.
 *
 * Un grupo lo forman DOS filas. El editor solo devuelve la que se estaba
 * editando, así que al encadenar hay que escribir el id también en la de
 * arriba: sin esto el grupo existía a medias —una fila con id y la otra sin
 * él— y `groupPlanExercises`, que exige que coincidan, no pintaba la
 * superserie por ninguna parte.
 */
export function replaceExerciseInDay(
  days: RoutineDays,
  day: DayOfWeek,
  index: number,
  next: RoutineExercise,
): RoutineDays {
  const exercises = days[day].exercises;
  const previous = index > 0 ? (exercises[index - 1] ?? null) : null;

  return {
    ...days,
    [day]: {
      ...days[day],
      exercises: exercises.map((ex, i) => {
        if (i === index) return next;
        if (i === index - 1 && next.supersetId && previous?.supersetId !== next.supersetId) {
          return { ...ex, supersetId: next.supersetId };
        }
        return ex;
      }),
    },
  };
}
