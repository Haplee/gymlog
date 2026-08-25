// Helpers puros de HistoryPage: rango de reps y construcción de rutina custom.
import type { Routine, RoutineExercise, DayOfWeek } from '@features/routine/stores/routineStore';
import type { WorkoutSetWithDetails, WorkoutWithSets } from '@shared/lib/types';
import { isRepSet } from '@shared/lib/setShape';

export function repsRange(reps: number[]): string {
  if (!reps.length) return '';
  const min = Math.min(...reps);
  const max = Math.max(...reps);
  return min === max ? String(min) : `${min}-${max}`;
}

/** Un ejercicio del entreno, con sus series ya resumidas en una línea. */
export interface ExerciseSummary {
  name: string;
  setCount: number;
  /** Repeticiones observadas: "8" si todas iguales, "8-10" si varían. */
  reps: string;
  /** Peso observado, con el mismo criterio: "115" o "115-125". */
  weight: string;
}

/**
 * Agrupa las series de un entreno por ejercicio, en el orden en que aparecen.
 *
 * El historial pintaba una píldora por serie, así que un entreno normal se leía
 * como «Hip thrust: 8×115», «Hip thrust: 9×115», «Hip thrust: 10×115», … — el
 * nombre repetido tantas veces como series y el dato útil disuelto entre ellas.
 * Resumido por ejercicio, ese mismo entreno son tres líneas en vez de nueve.
 */
export function groupSetsByExercise(sets: WorkoutSetWithDetails[]): ExerciseSummary[] {
  const map = new Map<string, { reps: number[]; weights: number[] }>();
  for (const s of sets) {
    const name = s.exercise?.name?.trim();
    if (!name) continue;
    // Un resumen «8-10 reps» no sabe describir una plancha. Cuando existan las
    // series por tiempo habrá que darles su propio resumen («45-60 s»); hasta
    // entonces esto no descarta nada, porque `reps` es NOT NULL.
    // Ver openspec/changes/add-logging-modes/ tarea 3.4.
    if (!isRepSet(s)) continue;
    const entry = map.get(name) ?? { reps: [], weights: [] };
    entry.reps.push(s.reps);
    entry.weights.push(s.weight);
    map.set(name, entry);
  }
  return [...map].map(([name, { reps, weights }]) => ({
    name,
    setCount: reps.length,
    reps: repsRange(reps),
    weight: repsRange(weights),
  }));
}

// Crea una rutina custom a partir de los entrenos de un día: agrupa por ejercicio
// (sets = nº de series, reps = rango observado) y los coloca en el día de hoy.
export function buildTemplateFromWorkouts(dayWorkouts: WorkoutWithSets[], name: string): Routine {
  const map = new Map<string, number[]>();
  for (const wo of dayWorkouts) {
    for (const s of wo.sets) {
      const exName = s.exercise?.name?.trim();
      if (!exName) continue;
      // Misma razón que arriba: el rango de repeticiones de la plantilla se
      // construye solo con las series que se miden en repeticiones.
      if (!isRepSet(s)) continue;
      const arr = map.get(exName) ?? [];
      arr.push(s.reps);
      map.set(exName, arr);
    }
  }
  const exercises: RoutineExercise[] = [...map].map(([exName, reps]) => ({
    name: exName,
    sets: reps.length,
    reps: repsRange(reps),
  }));
  const mkRest = () => ({ name: 'Descanso', exercises: [] as RoutineExercise[] });
  const days: Routine['days'] = {
    monday: mkRest(),
    tuesday: mkRest(),
    wednesday: mkRest(),
    thursday: mkRest(),
    friday: mkRest(),
    saturday: mkRest(),
    sunday: mkRest(),
  };
  const today = (
    ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as DayOfWeek[]
  )[new Date().getDay()];
  days[today] = { name, exercises };
  return {
    id: `custom-${Date.now()}`,
    name,
    description: '',
    isCustom: true,
    createdAt: new Date().toISOString(),
    days,
  };
}
