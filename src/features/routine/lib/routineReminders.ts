import { useRoutineStore, DAY_ORDER, type DayOfWeek } from '@features/routine/stores/routineStore';
import type { ReminderDay } from '@shared/lib/notifications';

/** JS DayOfWeek → weekday Capacitor (1=domingo … 7=sábado) */
const DAY_TO_WEEKDAY: Record<DayOfWeek, number> = {
  sunday: 1,
  monday: 2,
  tuesday: 3,
  wednesday: 4,
  thursday: 5,
  friday: 6,
  saturday: 7,
};

/**
 * Días con rutina (ejercicios > 0) de la rutina activa, en formato
 * recordatorio. Vive en el feature de rutina porque lee su store: los módulos
 * de @shared (recordatorios, notificaciones) lo reciben como argumento en vez
 * de importar el store directamente.
 */
export function getRoutineReminderDays(): ReminderDay[] {
  const store = useRoutineStore.getState();
  if (!store.getActiveRoutine()) return [];

  // Se lee dia a dia con `getRoutineDay` en vez de recorrer `active.days` para
  // que los avisos respeten la reorganizacion de la semana: si el entreno del
  // martes se movio al viernes, el recordatorio tiene que sonar el viernes. En
  // cuanto el plan caduca, esto vuelve solo a la rutina de siempre.
  return DAY_ORDER.flatMap((day: DayOfWeek) => {
    const routine = store.getRoutineDay(day);
    if (!routine || routine.exercises.length === 0) return [];
    return [{ weekday: DAY_TO_WEEKDAY[day], routineName: routine.name }];
  });
}
