import { useQuery } from '@tanstack/react-query';
import {
  fetchBodyMeasurements,
  fetchExerciseNotes,
  fetchExercises,
  fetchPersonalRecords,
  fetchWorkoutsPaginated,
} from '@shared/api/queries';
import { bodyWeightAtDate } from '@features/workout/utils/bodyweight';
import { toLocalDateKey } from '@shared/lib/dateKeys';
import {
  useWearableDaily,
  useWearableSleep,
} from '@features/wearables/hooks/useWearableConnections';
import { pickDaily } from '@features/wearables/utils/pickDaily';

interface WorkoutPageQueriesArgs {
  userId: string | undefined;
  activeExerciseId: string | null;
  /** Sin sesión en curso: solo entonces se pide el último entreno «repetir». */
  isIdle: boolean;
}

/**
 * Todas las lecturas que necesita `WorkoutPage`, con sus `enabled` y `staleTime`.
 *
 * Estaban repartidas por la página; aquí el cache de TanStack Query se ve de un
 * vistazo y la página solo consume el resultado.
 */
export function useWorkoutPageQueries({
  userId,
  activeExerciseId,
  isIdle,
}: WorkoutPageQueriesArgs) {
  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', userId],
    queryFn: () => fetchExercises(userId ?? ''),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: personalRecordsList = [] } = useQuery({
    queryKey: ['personalRecords', userId],
    queryFn: () => fetchPersonalRecords(userId ?? ''),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: exerciseNotes = [] } = useQuery({
    queryKey: ['exerciseNotes', userId, activeExerciseId],
    queryFn: () => fetchExerciseNotes(userId ?? '', activeExerciseId ?? ''),
    enabled: !!userId && !!activeExerciseId,
  });

  // Último entreno completo: solo cuando no hay sesión en curso, para ofrecer
  // "Repetir último entreno" como acción rápida.
  const { data: lastWorkoutPage } = useQuery({
    queryKey: ['lastWorkoutFull', userId],
    queryFn: () => fetchWorkoutsPaginated(userId ?? '', null, 1),
    enabled: !!userId && isIdle,
    staleTime: 1000 * 60 * 5,
  });

  // Peso corporal vigente (hoy) para ejercicios de peso corporal.
  const { data: bodyMeasurements = [] } = useQuery({
    queryKey: ['bodyMeasurements', userId],
    queryFn: () => fetchBodyMeasurements(userId ?? ''),
    enabled: !!userId,
    staleTime: 1000 * 60 * 30,
  });

  // Resumen de salud (wearable) para la tarjeta glanceable del inicio.
  // Varios días, no uno: de madrugada el día en curso no tiene pulsaciones y
  // hay que caer al último con datos reales (ver pickDaily).
  const { data: wearableDaily } = useWearableDaily(7);
  const { data: wearableSleep } = useWearableSleep(7);

  return {
    exercises,
    personalRecordsList,
    exerciseNotes,
    lastWorkout: lastWorkoutPage?.workouts[0],
    // Fecha local, no UTC: de madrugada `toISOString()` devuelve el día anterior
    // y se usaba el peso de ayer teniendo el de hoy.
    currentBodyWeight: bodyWeightAtDate(bodyMeasurements, toLocalDateKey(new Date())),
    wearableDaily,
    wearableSleep,
    hasWearableData: Boolean(wearableDaily?.length || wearableSleep?.length),
    wearableDay: pickDaily(wearableDaily),
  };
}
