import { openDB, type IDBPDatabase } from 'idb';
import { supabase } from './supabase';
import { devError } from './devtools';

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

/**
 * Intenta enviar todos los entrenos en cola. Devuelve cuántos se sincronizaron.
 * Los que fallan se conservan para el siguiente intento.
 */
export async function flushWorkoutOutbox(): Promise<number> {
  const pending = await getPendingWorkouts();
  if (!pending.length) return 0;

  let flushed = 0;
  for (const w of pending) {
    try {
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
        // Entrada inválida (sin ejercicio): descartar para no bloquear la cola.
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
      if (isNetworkError(err)) break; // sin red: parar y reintentar más tarde
      devError('[workoutOutbox] flush entry failed:', err);
      // Error no de red (p.ej. validación): descartar para no atascar la cola.
      await removeWorkout(w.id);
    }
  }
  return flushed;
}
