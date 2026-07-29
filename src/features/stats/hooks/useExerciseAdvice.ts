import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchExerciseSessions } from '@shared/api/queries';
import {
  useWearableDaily,
  useWearableSleep,
} from '@features/wearables/hooks/useWearableConnections';
import { computeReadiness } from '@features/wearables/utils/readiness';
import { suggestNextLoad, detectStall, applyReadiness } from '../utils/autoregulation';
import type { ExerciseAdvice } from './useAutoregulation';

/**
 * Sugerencia de carga para UN ejercicio, pensada para la pantalla de entreno.
 *
 * `useAutoregulation` trabaja sobre las series que ya tiene cargadas la pantalla
 * de estadísticas y devuelve un ranking de varios ejercicios. Aquí el ejercicio
 * ya lo ha elegido el usuario y no hay historial cargado, así que se consulta
 * solo el suyo: traer 300 entrenos enteros para mirar uno sería absurdo en la
 * pantalla que más se abre.
 *
 * Sigue siendo cálculo local: la consulta es a la base del propio usuario y el
 * motor es determinista. Funciona con el entrenador IA apagado.
 */
export function useExerciseAdvice(
  userId: string | undefined,
  exerciseId: string | undefined,
): ExerciseAdvice | null {
  const { data: sessions = [] } = useQuery({
    queryKey: ['exerciseSessions', userId, exerciseId],
    queryFn: () => fetchExerciseSessions(userId ?? '', exerciseId ?? ''),
    enabled: !!userId && !!exerciseId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: daily } = useWearableDaily();
  const { data: sleep } = useWearableSleep();
  const readiness = useMemo(() => computeReadiness(daily, sleep), [daily, sleep]);

  return useMemo(() => {
    if (sessions.length === 0) return null;
    const autoRegSessions = sessions.map((s) => ({ date: s.started_at, sets: s.sets }));
    const suggestion = applyReadiness(suggestNextLoad(autoRegSessions), readiness);
    if (!suggestion) return null;
    return {
      // El nombre lo pone quien pinta la tarjeta: aquí solo se conoce el id.
      exercise: '',
      suggestion,
      stall: detectStall(autoRegSessions),
    };
  }, [sessions, readiness]);
}
