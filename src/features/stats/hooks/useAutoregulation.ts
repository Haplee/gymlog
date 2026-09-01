import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useWearableDaily,
  useWearableSleep,
} from '@features/wearables/hooks/useWearableConnections';
import { computeReadiness } from '@features/wearables/utils/readiness';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { fetchExercises } from '@shared/api/queries';
import { resolveExerciseRepRange } from '@shared/lib/exerciseTargets';
import { normalizeExerciseName } from '@shared/lib/progressionCycle';
import { isBodyweightLoad } from '@shared/lib/loadType';
import { useLoadStep } from '@shared/hooks/useLoadStep';
import type { AutoRegSession, LoadSuggestion, StallResult } from '../utils/autoregulation';
import { buildLoadAdvice } from '../utils/loadAdvisor';
import { buildVolumeContext, type VolumeContext, type VolumeSet } from '../utils/trainingLoad';

/** Forma mínima que necesita el motor; evita acoplarse al tipo de la query. */
interface SetLike {
  weight: number;
  reps: number;
  rir?: number | null;
  rpe?: number | null;
  is_warmup?: boolean | null;
  exercise?: { name?: string; muscle_group?: string } | null;
  workout?: { started_at: string | null } | null;
}

export interface ExerciseAdvice {
  exercise: string;
  suggestion: LoadSuggestion;
  stall: StallResult | null;
  /** Volumen semanal del grupo muscular, cuando se conoce. */
  volume?: VolumeContext | null;
}

/** Agrupa las series de un ejercicio en sesiones por día. */
function toSessions(sets: SetLike[]): AutoRegSession[] {
  const byDate = new Map<string, AutoRegSession>();
  for (const s of sets) {
    const startedAt = s.workout?.started_at;
    if (!startedAt) continue;
    const key = startedAt.slice(0, 10);
    const session = byDate.get(key);
    const set = {
      weight: s.weight,
      reps: s.reps,
      rir: s.rir,
      rpe: s.rpe,
      is_warmup: s.is_warmup,
    };
    if (session) session.sets.push(set);
    else byDate.set(key, { date: startedAt, sets: [set] });
  }
  return [...byDate.values()];
}

/**
 * Sugerencias de carga por ejercicio a partir del esfuerzo ya registrado.
 *
 * Todo se calcula en el dispositivo y no sale nada de él: esto funciona con el
 * entrenador IA apagado, que es la condición de que la app no pierda nada por
 * no activarlo.
 *
 * **El contexto por ejercicio se resuelve aquí igual que en la pantalla de
 * entreno**, y ese «igual» es el arreglo: hasta ahora este hook llamaba a
 * `buildLoadAdvice` sin rango de reps, sin modalidad de carga y sin «por lado»,
 * mientras `useExerciseAdvice` sí los pasaba. El mismo ejercicio con el mismo
 * historial recomendaba 82,5 kg × 6 en la pantalla de entreno y 80 kg × 7 en
 * estadísticas; en peso corporal era peor, porque sin la bandera `bodyweight`
 * esta pantalla mandaba «sube a 82,5 kg» en unas dominadas. Ver
 * `suggestionParity.test.ts`.
 *
 * Va memoizado sobre `sets` porque recalcularlo en cada render de una pantalla
 * con tantos gráficos se nota, aunque la aritmética en sí sea trivial.
 */
export function useAutoregulation(sets: SetLike[], limit = 3): ExerciseAdvice[] {
  const { data: daily } = useWearableDaily();
  const { data: sleep } = useWearableSleep();
  const user = useAuthStore((s) => s.user);
  const stepFor = useLoadStep();

  // Catálogo: aporta la modalidad de carga y el material de cada ejercicio.
  // Misma clave que WorkoutPage y RoutinePage, así que normalmente ya está en
  // caché y esto no dispara ninguna petición.
  const { data: catalog = [] } = useQuery({
    queryKey: ['exercises', user?.id],
    queryFn: () => fetchExercises(user?.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // La rutina activa aporta el rango de reps objetivo y el «por lado». Se leen
  // las piezas que la hacen cambiar, no el getter: con `getActiveRoutine()` el
  // hook se quedaría con una rutina obsoleta (mismo motivo que en
  // `useExerciseRepRange`).
  const routines = useRoutineStore((s) => s.routines);
  const activeRoutineId = useRoutineStore((s) => s.activeRoutineId);
  const routine = useMemo(
    () => routines.find((r) => r.id === activeRoutineId) ?? null,
    [routines, activeRoutineId],
  );

  const catalogByName = useMemo(
    () => new Map(catalog.map((e) => [normalizeExerciseName(e.name), e])),
    [catalog],
  );

  /** ¿La rutina programa este ejercicio por lado? */
  const perSideByName = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const day of Object.values(routine?.days ?? {})) {
      for (const ex of day?.exercises ?? []) {
        map.set(normalizeExerciseName(ex.name), ex.perSide === true);
      }
    }
    return map;
  }, [routine]);

  // Sin wearable esto es null y las sugerencias salen intactas.
  const readiness = useMemo(() => computeReadiness(daily, sleep), [daily, sleep]);

  return useMemo(() => {
    const byExercise = new Map<string, SetLike[]>();
    // Las series duras de TODOS los ejercicios, para poder medir el volumen
    // semanal del grupo muscular: subir carga en press banca depende de cuánto
    // pecho lleva la semana, no solo de cómo fue el press banca.
    const volumeSets: VolumeSet[] = [];
    for (const s of sets) {
      const name = s.exercise?.name;
      if (!name || !s.weight || !s.reps) continue;
      const startedAt = s.workout?.started_at;
      const muscleGroup = s.exercise?.muscle_group;
      if (!s.is_warmup && startedAt && muscleGroup) {
        volumeSets.push({ date: startedAt, muscleGroup });
      }
      const bucket = byExercise.get(name);
      if (bucket) bucket.push(s);
      else byExercise.set(name, [s]);
    }

    const advice: ExerciseAdvice[] = [];
    for (const [exercise, exerciseSets] of byExercise) {
      const sessions = toSessions(exerciseSets);
      const muscleGroup = exerciseSets.find((s) => s.exercise?.muscle_group)?.exercise
        ?.muscle_group;
      const volume = muscleGroup ? buildVolumeContext(volumeSets, muscleGroup) : null;
      const key = normalizeExerciseName(exercise);
      const ficha = catalogByName.get(key);
      const { repMin, repMax } = resolveExerciseRepRange(exercise, routine);
      // Misma cadena y **mismos parámetros** que `useExerciseAdvice`: si las dos
      // pantallas no comparten compositor acaban recomendando cosas distintas.
      const advised = buildLoadAdvice({
        sessions,
        repMin,
        repMax,
        bodyweight: isBodyweightLoad(ficha?.load_type),
        perSide: perSideByName.get(key) === true,
        stepKg: stepFor(ficha?.equipment),
        volume,
        readiness,
      });
      if (!advised) continue;
      advice.push({ exercise, ...advised });
    }

    // Primero lo accionable: bajar carga o estar estancado importa más que un
    // "sigue igual". A igualdad, más evidencia detrás.
    const priority = (a: ExerciseAdvice) =>
      a.suggestion.action === 'reduce'
        ? 0
        : a.stall?.stalled
          ? 1
          : a.suggestion.action === 'increase'
            ? 2
            : 3;

    return advice
      .sort(
        (a, b) =>
          priority(a) - priority(b) ||
          b.suggestion.confidence.localeCompare(a.suggestion.confidence),
      )
      .slice(0, limit);
  }, [sets, readiness, limit, stepFor, catalogByName, perSideByName, routine]);
}
