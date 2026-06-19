import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { useAuthStore } from '@features/auth/stores/authStore';
import {
  useRoutineStore,
  dayLabels,
  type DayOfWeek,
  type DayRoutine,
} from '@features/routine/stores/routineStore';
import { notify, syncRoutineReminders, type ReminderDay } from '@shared/lib/notifications';

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

export function useWorkoutReminder() {
  const { user } = useAuthStore();
  const { getTodayRoutine, getDayName } = useRoutineStore();
  const routines = useRoutineStore((s) => s.routines);
  const activeRoutineId = useRoutineStore((s) => s.activeRoutineId);

  const { data: lastWorkout } = useQuery({
    queryKey: ['lastWorkout', user?.id],
    queryFn: async () => {
      if (!user) return null;
      // maybeSingle: con 0 entrenamientos single() devuelve error PGRST116
      const { data } = await supabase
        .from('workouts')
        .select('created_at, started_at')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Recordatorios semanales del sistema: se reprograman al cambiar la rutina activa
  // (disparan a su hora aunque la app esté cerrada)
  useEffect(() => {
    void syncRoutineReminders(getReminderDays());
  }, [routines, activeRoutineId]);

  // Aviso inmediato al abrir la app si hoy toca rutina y no entrena desde ayer
  useEffect(() => {
    if (!lastWorkout || sessionStorage.getItem('reminder_sent')) return;

    const lastDate = new Date(lastWorkout.started_at || new Date()).getTime();
    const diffHours = (Date.now() - lastDate) / (1000 * 60 * 60);

    const todayRoutine = getTodayRoutine();

    if (diffHours > 23 && todayRoutine && todayRoutine.exercises.length > 0) {
      const dayEs = dayLabels[getDayName()];

      void notify('Tienes entrenamiento hoy', {
        body: `Tu rutina de ${dayEs} está lista. ¿Empezamos?`,
        icon: '/icon-192x192.webp',
        url: '/',
      });

      sessionStorage.setItem('reminder_sent', 'true');
    }
  }, [lastWorkout, getTodayRoutine, getDayName]);
}
