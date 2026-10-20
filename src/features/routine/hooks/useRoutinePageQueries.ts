import { useQuery } from '@tanstack/react-query';
import { fetchExercises, fetchRecentSets } from '@shared/api/queries';

/**
 * Lecturas de `RoutinePage`: catálogo de ejercicios y series recientes.
 *
 * Estaban repartidas por la página; aquí el cache de TanStack Query se ve de un
 * vistazo y la página solo consume los datos.
 *
 * Las series recientes solo se piden con el auto-relleno activo: sin él nadie
 * las mira, y la consulta arrastra 300 entrenos.
 */
export function useRoutinePageQueries(userId: string | undefined, autoFillWeights: boolean) {
  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', userId],
    queryFn: () => fetchExercises(userId),
    enabled: !!userId,
  });

  const { data: recentSets = [] } = useQuery({
    queryKey: ['recentSets', userId],
    queryFn: () => fetchRecentSets(userId ?? ''),
    enabled: !!userId && autoFillWeights,
    staleTime: 1000 * 60 * 5,
  });

  return { exercises, recentSets };
}
