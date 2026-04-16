import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useRoutineStore, dayLabels } from '@features/routine/stores/routineStore';
import { notify } from '@shared/lib/notifications';

export function useWorkoutReminder() {
  const { user } = useAuthStore();
  const { getTodayRoutine, getDayName } = useRoutineStore();

  const { data: lastWorkout } = useQuery({
    queryKey: ['lastWorkout', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('workouts')
        .select('created_at, started_at')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!lastWorkout || sessionStorage.getItem('reminder_sent')) return;

    const lastDate = new Date(lastWorkout.started_at || new Date()).getTime();
    const now = new Date().getTime();
    const diffHours = (now - lastDate) / (1000 * 60 * 60);

    const todayRoutine = getTodayRoutine();

    if (diffHours > 23 && todayRoutine && todayRoutine.exercises.length > 0) {
      const dayEn = getDayName();
      const dayEs = dayLabels[dayEn];

      notify('💪 Tienes entrenamiento hoy', {
        body: `Tu rutina de ${dayEs} está lista. ¿Empezamos?`,
        icon: '/icons/icon-192x192.png',
        url: '/workout',
      });

      sessionStorage.setItem('reminder_sent', 'true');
    }
  }, [lastWorkout, getTodayRoutine, getDayName]);
}
