import { openDB, type IDBPDatabase } from 'idb';
import { supabase } from './supabase';
import { devError, devLog } from './devtools';

const DB_NAME = 'gymlog-outbox';
const STORE = 'workouts';

// Apertura perezosa: no tocar IndexedDB hasta el primer uso real (evita fallos
// al importar el módulo en entornos sin IndexedDB, p.ej. tests/SSR).
let dbPromise: Promise<IDBPDatabase> | null = null;
function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export interface OutboxSet {
  set_num: number;
  reps: number;
  weight: number;
  is_warmup: boolean;
  notes: string;
  rpe: string;
  set_type: string;
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2_000;

export interface OutboxWorkout {
  id: string;
  userId: string;
  exerciseId: string | null;
  customExerciseName: string;
  customMuscleGroup: string;
  startedAt: string;
  finishedAt: string;
  sets: OutboxSet[];
  notes?: string;
  rating?: number | null;
  createdAt: string;
  retryCount?: number;
}

/** Heurística: ¿el error parece de red (sin conexión / fetch fallido)? */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('offline')
  );
}

export async function enqueueWorkout(entry: OutboxWorkout): Promise<void> {
  await (await getDb()).put(STORE, entry);
}

export async function getPendingWorkouts(): Promise<OutboxWorkout[]> {
  return (await getDb()).getAll(STORE);
}

export async function countPendingWorkouts(): Promise<number> {
  return (await getDb()).count(STORE);
}

async function removeWorkout(id: string): Promise<void> {
  await (await getDb()).delete(STORE, id);
}

function retryDelay(attempt: number): number {
  return BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 1_000;
}

/**
 * Intenta enviar todos los entrenos en cola. Devuelve cuántos se sincronizaron.
 * Los que fallan por error de red se conservan con backoff exponencial.
 * Los que exceden MAX_RETRIES se descartan para no atascar la cola.
 */
export async function flushWorkoutOutbox(): Promise<number> {
  const pending = await getPendingWorkouts();
  if (!pending.length) return 0;

  let flushed = 0;
  for (const w of pending) {
    try {
      const attempt = (w.retryCount ?? 0) + 1;
      if (attempt > MAX_RETRIES) {
        devError(`[workoutOutbox] descartado tras ${MAX_RETRIES} intentos: ${w.id}`);
        await removeWorkout(w.id);
        continue;
      }

      let exerciseId = w.exerciseId;
      if (!exerciseId && w.customExerciseName.trim()) {
        const { data, error } = await supabase
          .from('exercises')
          .insert({
            name: w.customExerciseName.trim(),
            user_id: w.userId,
            muscle_group: w.customMuscleGroup,
          })
          .select('id')
          .single();
        if (error) throw error;
        exerciseId = data.id;
      }
      if (!exerciseId) {
        await removeWorkout(w.id);
        continue;
      }

      const { error: rpcError } = await supabase.rpc('save_workout_with_sets', {
        p_user_id: w.userId,
        p_exercise_id: exerciseId,
        p_started_at: w.startedAt,
        p_finished_at: w.finishedAt,
        p_sets: w.sets,
        p_notes: w.notes,
        p_rating: w.rating ?? undefined,
      });
      if (rpcError) throw rpcError;

      await removeWorkout(w.id);
      flushed += 1;
    } catch (err) {
      if (isNetworkError(err)) {
        w.retryCount = (w.retryCount ?? 0) + 1;
        await (await getDb()).put(STORE, w);
        devLog(
          `[workoutOutbox] reintento ${w.retryCount}/${MAX_RETRIES} en ${retryDelay(w.retryCount)}ms: ${w.id}`,
        );
        break;
      }
      devError('[workoutOutbox] flush entry failed:', err);
      await removeWorkout(w.id);
    }
  }
  return flushed;
}
