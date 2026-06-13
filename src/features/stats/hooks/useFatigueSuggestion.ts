import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import { fetchRecentSets } from '@shared/api/queries';
import { notify } from '@shared/lib/notifications';
import { toLocalDateKey } from '@shared/lib/dateKeys';
import { analyzeMuscleRecovery, getSuggestedMuscleGroup } from '../utils/fatigueAnalysis';

const STORAGE_KEY = 'fatigue_suggestion_date';

/**
 * Aviso "hoy toca X": si hay un grupo muscular sin entrenar hace tiempo
 * (needs-attention) y el usuario no ha entrenado hoy, sugiere entrenarlo.
 * Como máximo una vez por día natural.
 */
export function useFatigueSuggestion() {
  const { user } = useAuthStore();

  const { data: recentSets = [] } = useQuery({
    queryKey: ['recentSets', user?.id],
    queryFn: () => fetchRecentSets(user?.id ?? ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!user || recentSets.length === 0) return;

    const todayKey = toLocalDateKey(new Date());
    if (localStorage.getItem(STORAGE_KEY) === todayKey) return;

    // No avisar si ya entrenó hoy.
    const trainedToday = recentSets.some((s) => {
      const startedAt = s.workout?.started_at;
      return startedAt && toLocalDateKey(new Date(startedAt)) === todayKey;
    });
    if (trainedToday) return;

    const suggested = getSuggestedMuscleGroup(analyzeMuscleRecovery(recentSets));
    if (!suggested) return;

    void notify('Hoy toca entrenar', {
      body: `${suggested} lleva días sin trabajarse. ¿Le damos hoy?`,
      icon: '/icon-192x192.webp',
      url: '/',
    });
    localStorage.setItem(STORAGE_KEY, todayKey);
  }, [user, recentSets]);
}
