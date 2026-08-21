import { useMemo } from 'react';
import {
  useWearableDaily,
  useWearableSleep,
} from '@features/wearables/hooks/useWearableConnections';
import { computeReadiness } from '@features/wearables/utils/readiness';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { smallestLoadStep } from '@shared/lib/loadStep';
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
 * Va memoizado sobre `sets` porque recalcularlo en cada render de una pantalla
 * con tantos gráficos se nota, aunque la aritmética en sí sea trivial.
 */
export function useAutoregulation(sets: SetLike[], limit = 3): ExerciseAdvice[] {
  const { data: daily } = useWearableDaily();
  const { data: sleep } = useWearableSleep();
  const plates = useSettingsStore((s) => s.availablePlatesKg);

  // Sin wearable esto es null y las sugerencias salen intactas.
  const readiness = useMemo(() => computeReadiness(daily, sleep), [daily, sleep]);
  const stepKg = useMemo(() => smallestLoadStep(plates), [plates]);

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
      // Misma cadena que `useExerciseAdvice`, y por el mismo sitio: si las dos
      // pantallas no comparten compositor acaban recomendando cosas distintas.
      const advised = buildLoadAdvice({ sessions, stepKg, volume, readiness });
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
  }, [sets, readiness, limit, stepKg]);
}
