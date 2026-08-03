import {
  useRoutineStore,
  type DayOfWeek,
  type DayRoutine,
} from '@features/routine/stores/routineStore';
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
  const active = useRoutineStore.getState().getActiveRoutine();
  if (!active) return [];
  return (Object.entries(active.days) as [DayOfWeek, DayRoutine][])
    .filter(([, day]) => day.exercises.length > 0)
    .map(([day, dayRoutine]) => ({
      weekday: DAY_TO_WEEKDAY[day],
      routineName: dayRoutine.name,
    }));
}
