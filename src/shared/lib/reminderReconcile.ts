import { supabase } from '@shared/lib/supabase';
import { toLocalDateKey } from '@shared/lib/dateKeys';
import {
  isNative,
  canNotifyAsync,
  syncRoutineReminders,
  scheduleStreakReminder,
  cancelStreakReminder,
  type ReminderDay,
} from '@shared/lib/notifications';
import { useSettingsStore } from '@shared/stores/settingsStore';
import {
  useRoutineStore,
  type DayOfWeek,
  type DayRoutine,
} from '@features/routine/stores/routineStore';
import { devError } from '@shared/lib/devtools';

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

/** Días con rutina (ejercicios > 0) de la rutina activa, en formato recordatorio. */
export function getReminderDays(): ReminderDay[] {
  const active = useRoutineStore.getState().getActiveRoutine();
  if (!active) return [];
  return (Object.entries(active.days) as [DayOfWeek, DayRoutine][])
    .filter(([, day]) => day.exercises.length > 0)
    .map(([day, dayRoutine]) => ({
      weekday: DAY_TO_WEEKDAY[day],
      routineName: dayRoutine.name,
    }));
}

/** Comprueba si el usuario ha registrado un workout hoy (fecha local). */
export async function hasTrainedToday(userId: string): Promise<boolean> {
  const today = toLocalDateKey(new Date());
  const startOfDay = `${today}T00:00:00`;
  const { data } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .gte('started_at', startOfDay)
    .limit(1);
  return !!data && data.length > 0;
}

/**
 * Reprograma las alarmas nativas dependientes del estado de entrenamiento
 * (recordatorio de rutina + racha en peligro) de forma coherente con si el
 * usuario ya ha entrenado hoy.
 *
 * Es el único punto que decide "¿toca avisar hoy?", y se invoca en cada momento
 * en que ese estado puede cambiar: al abrir la app, al reanudarla, justo
 * después de guardar un entrenamiento y al tocar el ajuste que lo gobierna.
 * Solo actúa en nativo con permiso.
 *
 * El ajuste `trainingReminders` gobierna solo los avisos que empujan a entrenar
 * (rutina del día + racha). El resumen semanal es un informe, no un aviso, así
 * que cuelga del toggle global de notificaciones, no de este.
 *
 * @param opts.trainedToday  fuerza el valor sin consultar la BD (p. ej. tras
 *                           guardar un entreno sabemos que ya se entrenó hoy).
 */
export async function reconcileReminders(
  userId: string,
  opts?: { trainedToday?: boolean },
): Promise<void> {
  if (!userId) return;
  if (!isNative()) return;
  if (!(await canNotifyAsync())) return;

  try {
    // Desactivado: cancelar lo que hubiera programado. `syncRoutineReminders([])`
    // cancela los 7 días y sale, así que no hace falta un camino aparte.
    if (!useSettingsStore.getState().trainingReminders) {
      await syncRoutineReminders([]);
      await cancelStreakReminder();
      return;
    }

    const trainedToday = opts?.trainedToday ?? (await hasTrainedToday(userId));
    await syncRoutineReminders(getReminderDays(), trainedToday);
    await scheduleStreakReminder(trainedToday);
  } catch (e) {
    devError('[Reminders] Error reconciliando recordatorios:', e);
  }
}
