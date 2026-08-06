import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchExerciseSessions } from '@shared/api/queries';
import {
  useWearableDaily,
  useWearableSleep,
} from '@features/wearables/hooks/useWearableConnections';
import { computeReadiness } from '@features/wearables/utils/readiness';
import {
  suggestNextLoad,
  detectStall,
  applyReadiness,
  suggestFromLastSession,
} from '../utils/autoregulation';
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
 *
 * Si el historial existe pero ninguna sesión registra esfuerzo (ni RIR ni RPE),
 * el motor de autorregulación se niega a decidir y se cae a una sugerencia de
 * doble progresión sobre la última sesión (`suggestFromLastSession`), de modo
 * que registrar solo peso y reps también reciba una recomendación.
 */

export interface ExerciseAdviceOptions {
  /** Suelo y techo del rango de reps objetivo, p. ej. [8, 10] de «8-10». */
  repMin?: number;
  repMax?: number;
  /** En peso corporal no se sugiere subir carga: solo repeticiones. */
  bodyweight?: boolean;
}

export function useExerciseAdvice(
  userId: string | undefined,
  exerciseId: string | undefined,
  opts: ExerciseAdviceOptions = {},
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

    const raw =
      suggestNextLoad(autoRegSessions, {
        repMin: opts.repMin,
        repMax: opts.repMax,
        bodyweight: opts.bodyweight,
      }) ??
      suggestFromLastSession(autoRegSessions, {
        repMin: opts.repMin,
        repMax: opts.repMax,
        bodyweight: opts.bodyweight,
      });
    if (!raw) return null;

    const suggestion = applyReadiness(raw, readiness);
    if (!suggestion) return null;

    return {
      // El nombre lo pone quien pinta la tarjeta: aquí solo se conoce el id.
      exercise: '',
      suggestion,
      stall: detectStall(autoRegSessions),
    };
  }, [sessions, readiness, opts.repMin, opts.repMax, opts.bodyweight]);
}
