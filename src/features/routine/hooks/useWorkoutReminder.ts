import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { getRoutineReminderDays } from '@features/routine/lib/routineReminders';
import { notify, getRoutineReminderCopy, isNative } from '@shared/lib/notifications';
import { reconcileReminders, hasTrainedToday } from '@shared/lib/reminderReconcile';
import { toLocalDateKey } from '@shared/lib/dateKeys';
import { useSettingsStore } from '@shared/stores/settingsStore';

/** Ventana en la que tiene sentido empujar a entrenar al abrir la app. Sin
 *  ella el aviso saltaba a cualquier hora, incluida la madrugada. */
const OPEN_REMINDER_FROM_HOUR = 12;
const OPEN_REMINDER_TO_HOUR = 22;

export function useWorkoutReminder() {
  const user = useAuthStore((s) => s.user);
  const getTodayRoutine = useRoutineStore((s) => s.getTodayRoutine);
  const routines = useRoutineStore((s) => s.routines);
  const activeRoutineId = useRoutineStore((s) => s.activeRoutineId);
  // Mover un dia de esta semana tiene que reprogramar los avisos igual que
  // cambiar de rutina: si no, el recordatorio sigue sonando el dia vacio.
  const weekPlan = useRoutineStore((s) => s.weekPlan);
  const trainingReminders = useSettingsStore((s) => s.trainingReminders);

  // ¿Ha entrenado hoy? Fuente única para decidir si mostrar el aviso inmediato.
  // La fecha local va en la clave a propósito: el queryClient se persiste con
  // gcTime de 24h y refetchOnMount desactivado, así que sin ella la respuesta de
  // ayer se reutilizaba hoy y el aviso salía (o se callaba) por un dato caduco.
  const { data: trainedToday } = useQuery({
    queryKey: ['trainedToday', user?.id, toLocalDateKey(new Date())],
    queryFn: () => (user ? hasTrainedToday(user.id) : Promise.resolve(false)),
    enabled: !!user,
  });

  // Recordatorios semanales del sistema: se reprograman al cambiar la rutina
  // activa (disparan a su hora aunque la app esté cerrada). reconcileReminders
  // salta el aviso de hoy si el usuario ya ha entrenado.
  useEffect(() => {
    if (!user) return;
    void reconcileReminders(user.id, getRoutineReminderDays());
  }, [user, routines, activeRoutineId, weekPlan]);

  // Aviso inmediato al abrir la app si hoy toca rutina y aún no ha entrenado.
  //
  // Solo en web: en nativo esto duplicaba la alarma del sistema de las 18:30 y,
  // como la dedupe vivía en sessionStorage (que no sobrevive al arranque en
  // frío de la WebView), volvía a saltar en cada apertura de la app. La clave
  // ahora lleva la fecha local y vive en localStorage, así que avisa una vez al
  // día de verdad. Respeta además el ajuste de recordatorios y una franja
  // horaria razonable.
  useEffect(() => {
    if (isNative()) return;
    if (!trainingReminders) return;
    if (trainedToday === undefined || trainedToday) return;

    const now = new Date();
    const hour = now.getHours();
    if (hour < OPEN_REMINDER_FROM_HOUR || hour >= OPEN_REMINDER_TO_HOUR) return;

    const key = `reminder_sent_${toLocalDateKey(now)}`;
    if (localStorage.getItem(key)) return;

    const todayRoutine = getTodayRoutine();
    if (!todayRoutine || todayRoutine.exercises.length === 0) return;

    const copy = getRoutineReminderCopy(todayRoutine.name);
    void notify(copy.title, {
      body: copy.body,
      icon: '/icon-192x192.webp',
      url: '/',
    });
    localStorage.setItem(key, 'true');
  }, [trainedToday, getTodayRoutine, trainingReminders]);
}
