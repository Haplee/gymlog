// Helpers puros de HistoryPage: rango de reps y construcción de rutina custom.
import type { Routine, RoutineExercise, DayOfWeek } from '@features/routine/stores/routineStore';
import type { WorkoutWithSets } from '@shared/lib/types';

export function repsRange(reps: number[]): string {
  if (!reps.length) return '';
  const min = Math.min(...reps);
  const max = Math.max(...reps);
  return min === max ? String(min) : `${min}-${max}`;
}

// Crea una rutina custom a partir de los entrenos de un día: agrupa por ejercicio
// (sets = nº de series, reps = rango observado) y los coloca en el día de hoy.
export function buildTemplateFromWorkouts(dayWorkouts: WorkoutWithSets[], name: string): Routine {
  const map = new Map<string, number[]>();
  for (const wo of dayWorkouts) {
    for (const s of wo.sets) {
      const exName = s.exercise?.name?.trim();
      if (!exName) continue;
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
