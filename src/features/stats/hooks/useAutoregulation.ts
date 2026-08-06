import { useMemo } from 'react';
import {
  useWearableDaily,
  useWearableSleep,
} from '@features/wearables/hooks/useWearableConnections';
import { computeReadiness } from '@features/wearables/utils/readiness';
import {
  suggestNextLoad,
  suggestFromLastSession,
  detectStall,
  applyReadiness,
  type AutoRegSession,
  type LoadSuggestion,
  type StallResult,
} from '../utils/autoregulation';

/** Forma mínima que necesita el motor; evita acoplarse al tipo de la query. */
interface SetLike {
  weight: number;
  reps: number;
  rir?: number | null;
  rpe?: number | null;
  is_warmup?: boolean | null;
  exercise?: { name?: string } | null;
  workout?: { started_at: string | null } | null;
}

export interface ExerciseAdvice {
  exercise: string;
  suggestion: LoadSuggestion;
  stall: StallResult | null;
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

  // Sin wearable esto es null y las sugerencias salen intactas.
  const readiness = useMemo(() => computeReadiness(daily, sleep), [daily, sleep]);

  return useMemo(() => {
    const byExercise = new Map<string, SetLike[]>();
    for (const s of sets) {
      const name = s.exercise?.name;
      if (!name || !s.weight || !s.reps) continue;
      const bucket = byExercise.get(name);
      if (bucket) bucket.push(s);
      else byExercise.set(name, [s]);
    }

    const advice: ExerciseAdvice[] = [];
    for (const [exercise, exerciseSets] of byExercise) {
      const sessions = toSessions(exerciseSets);
      // Mismo encadenamiento que `useExerciseAdvice`: si la última sesión no
      // registra esfuerzo (RIR/RPE), el motor se niega a decidir y se cae a la
      // doble progresión sobre la última sesión.
      const suggestion = applyReadiness(
        suggestNextLoad(sessions) ?? suggestFromLastSession(sessions),
        readiness,
      );
      if (!suggestion) continue;
      advice.push({ exercise, suggestion, stall: detectStall(sessions) });
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
  }, [sets, readiness, limit]);
}
