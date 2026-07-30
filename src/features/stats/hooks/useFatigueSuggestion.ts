import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import { fetchRecentSets } from '@shared/api/queries';
import { notify } from '@shared/lib/notifications';
import { toLocalDateKey } from '@shared/lib/dateKeys';
import { analyzeMuscleRecovery, getSuggestedMuscleGroup } from '../utils/fatigueAnalysis';
import { useExerciseMusclesMap } from './useExerciseMusclesMap';

const STORAGE_KEY = 'fatigue_suggestion_date';

/**
 * Aviso "hoy toca X": si hay un grupo muscular ya recuperado (sin entrenar
 * hace ≥5 días) y el usuario no ha entrenado hoy, sugiere entrenarlo.
 * Como máximo una vez por día natural.
 */
export function useFatigueSuggestion() {
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();

  const { data: recentSets = [] } = useQuery({
    queryKey: ['recentSets', user?.id],
    queryFn: () => fetchRecentSets(user?.id ?? ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
  const musclesMap = useExerciseMusclesMap();

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

    const suggested = getSuggestedMuscleGroup(analyzeMuscleRecovery(recentSets, musclesMap));
    if (!suggested) return;

    void notify(t('coach.notify_train_title'), {
      body: t('coach.notify_train_body', { muscle: suggested }),
      icon: '/icon-192x192.webp',
      url: '/',
    });
    localStorage.setItem(STORAGE_KEY, todayKey);
  }, [user, recentSets, musclesMap, t]);
}
