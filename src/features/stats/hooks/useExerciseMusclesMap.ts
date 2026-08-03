import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import { fetchExerciseMusclesMap } from '@shared/api/queries';
import type { ExerciseMuscle } from '@shared/lib/types';

/**
 * Mapa `exercise_id → músculos ponderados`, compartido por las pantallas de
 * estadísticas para repartir el volumen entre los músculos de cada ejercicio.
 * Cacheado (el catálogo de músculos cambia poco).
 */
export function useExerciseMusclesMap(): Record<string, ExerciseMuscle[]> {
  const user = useAuthStore((s) => s.user);
  const { data } = useQuery({
    queryKey: ['exerciseMuscles', user?.id],
    queryFn: () => fetchExerciseMusclesMap(user?.id ?? ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 30,
  });
  return data ?? {};
}
