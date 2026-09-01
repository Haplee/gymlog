import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchExerciseSessions, fetchRecentMuscleSets } from '@shared/api/queries';
import { useLoadStep } from '@shared/hooks/useLoadStep';
import {
  useWearableDaily,
  useWearableSleep,
} from '@features/wearables/hooks/useWearableConnections';
import { computeReadiness } from '@features/wearables/utils/readiness';
import { buildLoadAdvice } from '../utils/loadAdvisor';
import { buildVolumeContext } from '../utils/trainingLoad';
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
  /** El ejercicio va por lado: el objetivo de reps sube de dos en dos. */
  perSide?: boolean;
  /** Grupo muscular del ejercicio, para medir el volumen semanal que acumula. */
  muscleGroup?: string;
  /**
   * Material del ejercicio (`exercises.equipment`). Decide el escalón mínimo:
   * una mancuerna no salta lo mismo que una barra, y una máquina de placas no
   * salta lo que digan los discos del usuario.
   */
  equipment?: string | null;
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

  // Volumen semanal del músculo: solo se pide si se sabe de qué músculo va.
  const { data: muscleSets = [] } = useQuery({
    queryKey: ['recentMuscleSets', userId],
    queryFn: () => fetchRecentMuscleSets(userId ?? ''),
    enabled: !!userId && !!opts.muscleGroup,
    staleTime: 1000 * 60 * 30,
  });

  const { data: daily } = useWearableDaily();
  const { data: sleep } = useWearableSleep();
  const readiness = useMemo(() => computeReadiness(daily, sleep), [daily, sleep]);

  const stepFor = useLoadStep();
  const equipment = opts.equipment ?? null;
  const stepKg = useMemo(() => stepFor(equipment), [stepFor, equipment]);
  const muscleGroup = opts.muscleGroup;
  const volume = useMemo(
    () => (muscleGroup ? buildVolumeContext(muscleSets, muscleGroup) : null),
    [muscleSets, muscleGroup],
  );

  return useMemo(() => {
    if (sessions.length === 0) return null;
    const advised = buildLoadAdvice({
      sessions: sessions.map((s) => ({ date: s.started_at, sets: s.sets })),
      repMin: opts.repMin,
      repMax: opts.repMax,
      bodyweight: opts.bodyweight,
      perSide: opts.perSide,
      stepKg,
      volume,
      readiness,
    });
    if (!advised) return null;

    // El nombre lo pone quien pinta la tarjeta: aquí solo se conoce el id.
    return { exercise: '', ...advised };
  }, [
    sessions,
    readiness,
    volume,
    stepKg,
    opts.repMin,
    opts.repMax,
    opts.bodyweight,
    opts.perSide,
  ]);
}
