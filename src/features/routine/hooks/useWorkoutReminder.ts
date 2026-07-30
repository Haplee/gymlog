import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { notify, getRoutineReminderCopy } from '@shared/lib/notifications';
import { reconcileReminders, hasTrainedToday } from '@shared/lib/reminderReconcile';

export function useWorkoutReminder() {
  const user = useAuthStore((s) => s.user);
  const getTodayRoutine = useRoutineStore((s) => s.getTodayRoutine);
  const routines = useRoutineStore((s) => s.routines);
  const activeRoutineId = useRoutineStore((s) => s.activeRoutineId);

  // ¿Ha entrenado hoy? Fuente única para decidir si mostrar el aviso inmediato.
  const { data: trainedToday } = useQuery({
    queryKey: ['trainedToday', user?.id],
    queryFn: () => (user ? hasTrainedToday(user.id) : Promise.resolve(false)),
    enabled: !!user,
  });

  // Recordatorios semanales del sistema: se reprograman al cambiar la rutina
  // activa (disparan a su hora aunque la app esté cerrada). reconcileReminders
  // salta el aviso de hoy si el usuario ya ha entrenado.
  useEffect(() => {
    if (!user) return;
    void reconcileReminders(user.id);
  }, [user, routines, activeRoutineId]);

  // Aviso inmediato al abrir la app si hoy toca rutina y aún no ha entrenado.
  useEffect(() => {
    if (trainedToday === undefined || sessionStorage.getItem('reminder_sent')) return;

    const todayRoutine = getTodayRoutine();

    if (!trainedToday && todayRoutine && todayRoutine.exercises.length > 0) {
      const copy = getRoutineReminderCopy(todayRoutine.name);
      void notify(copy.title, {
        body: copy.body,
        icon: '/icon-192x192.webp',
        url: '/',
      });

      sessionStorage.setItem('reminder_sent', 'true');
    }
  }, [trainedToday, getTodayRoutine]);
}
