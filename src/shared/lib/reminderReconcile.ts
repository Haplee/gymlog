import { supabase } from '@shared/lib/supabase';
import {
  isNative,
  canNotifyAsync,
  syncRoutineReminders,
  scheduleStreakReminder,
  cancelStreakReminder,
  scheduleWeeklySummaryReminder,
  type ReminderDay,
} from '@shared/lib/notifications';
import { checkStreakAtRisk } from '@shared/lib/streakChecker';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { devError } from '@shared/lib/devtools';

/** Medianoche local de hoy como instante absoluto (ISO con offset resuelto).
 *  `workouts.started_at` es `timestamptz`: mandar `YYYY-MM-DDT00:00:00` sin zona
 *  deja que el servidor elija la suya (UTC), y entonces el corte del día cae a
 *  las 02:00 locales en verano — un entreno de medianoche no contaba como "hoy". */
export function startOfLocalDayIso(now: Date = new Date()): string {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return midnight.toISOString();
}

/** Comprueba si el usuario ha registrado un workout hoy (día local). */
export async function hasTrainedToday(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .gte('started_at', startOfLocalDayIso())
    .limit(1);
  return !!data && data.length > 0;
}

/* ── Serialización de la reconciliación ─────────────────────────────
   `reconcileReminders` se invoca desde cinco sitios (arranque de los dos hooks,
   vuelta a foreground, guardado de entreno y los ajustes) y todos hacen
   cancel+schedule sobre los mismos ids. Sin serializar, dos ejecuciones se
   entrelazan y una cancela lo que la otra acaba de programar: alarmas que
   desaparecen o que se duplican. La cola garantiza orden; el token descarta las
   ejecuciones que ya han quedado obsoletas ("la última gana"). */
let queue: Promise<void> = Promise.resolve();
let latestToken = 0;

export async function reconcileReminders(
  userId: string,
  routineDays: ReminderDay[],
  opts?: { trainedToday?: boolean },
): Promise<void> {
  if (!userId) return;
  if (!isNative()) return;

  const token = ++latestToken;
  const run = queue.then(async () => {
    // Otra reconciliación posterior ya está en cola: esta no aporta nada y solo
    // añadiría una ventana de cancelado.
    if (token !== latestToken) return;
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
      await syncRoutineReminders(routineDays, trainedToday);

      // La alerta de racha solo tiene sentido si hay una racha real que perder.
      // Sin esta comprobación se programaba a diario para todo el mundo, y el
      // aviso "no pierdas tu racha" sonaba cada tarde sin racha ninguna. El
      // camino web ya lo comprobaba (useBackgroundNotifications); el nativo no.
      const atRisk = trainedToday ? false : await checkStreakAtRisk(userId);
      if (atRisk) {
        await scheduleStreakReminder(trainedToday);
      } else {
        await cancelStreakReminder();
      }
    } catch (e) {
      devError('[Reminders] Error reconciliando recordatorios:', e);
    }
  });

  // La cola no debe romperse si una ejecución falla.
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Reprograma TODO lo recurrente tras cambiar una hora en Ajustes.
 *
 * Cambiar la hora en el store no toca las alarmas que Android ya tiene
 * inscritas: seguirían sonando a la hora vieja hasta que se cancelen por id y
 * se vuelvan a programar. `reconcileReminders` cubre rutina y racha; el resumen
 * semanal se programa por su cuenta, así que sin esta función un cambio de día
 * u hora del resumen no llegaba nunca al sistema operativo.
 */
export async function applyReminderTimes(
  userId: string,
  routineDays: ReminderDay[],
): Promise<void> {
  await reconcileReminders(userId, routineDays);
  await scheduleWeeklySummaryReminder();
}
