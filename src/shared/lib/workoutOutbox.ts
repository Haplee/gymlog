import { openDB, type IDBPDatabase } from 'idb';
import { supabase } from './supabase';
import { devError, devLog } from './devtools';
import { resolveOrCreateExercise } from './resolveOrCreateExercise';

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
const MAX_DELAY_MS = 5 * 60_000; // tope del backoff: 5 min

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
  /** Epoch ms: no reintentar antes de este momento (backoff exponencial). */
  nextAttemptAt?: number;
  /**
   * Agotó los reintentos o es irrecuperable. Se **conserva** (no se borra, para
   * no perder el entreno del usuario) pero no se reintenta automáticamente.
   */
  failed?: boolean;
}

/** Heurística: ¿el error parece de red (sin conexión / fetch fallido)? */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  // Un error con código SQLSTATE o PGRST es una respuesta real del servidor
  // (la petición llegó): no es de red aunque el mensaje mencione 'fetch'.
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === 'string' && (/^[0-9A-Z]{5}$/.test(code) || code.startsWith('PGRST'))) {
      return false;
    }
  }
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
  const base = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
  return base + Math.random() * 1_000;
}

/**
 * Marca una entrada como fallida y la persiste. No la borra: perder el entreno
 * del usuario en silencio es peor que dejar la cola con un elemento visible que
 * podrá reintentarse manualmente en el futuro.
 */
async function markFailed(w: OutboxWorkout, reason: string): Promise<void> {
  w.failed = true;
  w.nextAttemptAt = undefined;
  await (await getDb()).put(STORE, w);
  devError(`[workoutOutbox] entrada conservada como fallida (${reason}): ${w.id}`);
}

/** Flush en vuelo, si lo hay. Coalescer contra él evita envíos duplicados. */
let inFlight: Promise<number> | null = null;
/** Alguien pidió otro flush mientras este corría: se hace una pasada más. */
let rerunRequested = false;

/**
 * Intenta enviar todos los entrenos en cola. Devuelve cuántos se sincronizaron.
 *
 * - Cada entrada que falla se reintenta con backoff exponencial (`nextAttemptAt`)
 *   y un fallo en una **no** detiene el procesado de las demás.
 * - Al agotar MAX_RETRIES la entrada se marca como `failed` y **se conserva**:
 *   nunca se borra en silencio, ni por error de red ni por error del servidor
 *   (RLS/validación), para no perder el entreno del usuario.
 * - **Nunca corren dos flush a la vez.** Se dispara al arrancar la app y en el
 *   evento `online`, que el navegador puede emitir más de una vez seguida: dos
 *   pasadas simultáneas leen la misma cola y mandan los mismos entrenos. La
 *   clave de idempotencia del servidor evita que eso duplique datos, pero la
 *   petición repetida y el borrado por partida doble siguen sobrando.
 *
 * Las llamadas que lleguen durante un flush se enganchan al que ya corre y
 * provocan **una** pasada adicional al terminar, para no dejarse lo que se haya
 * encolado mientras tanto.
 */
export function flushWorkoutOutbox(): Promise<number> {
  if (inFlight) {
    rerunRequested = true;
    return inFlight;
  }

  const run = (async () => {
    let total = await drainOutbox();
    if (rerunRequested) {
      rerunRequested = false;
      total += await drainOutbox();
    }
    return total;
  })().finally(() => {
    inFlight = null;
    rerunRequested = false;
  });

  inFlight = run;
  return run;
}

/** Una pasada sobre la cola. No usar directamente: entra por `flushWorkoutOutbox`. */
async function drainOutbox(): Promise<number> {
  const pending = await getPendingWorkouts();
  if (!pending.length) return 0;

  const now = Date.now();
  let flushed = 0;

  for (const w of pending) {
    // Fallida: se conserva pero no se reintenta automáticamente.
    if (w.failed) continue;
    // Backoff: aún no toca reintentar esta entrada.
    if (w.nextAttemptAt && w.nextAttemptAt > now) continue;

    try {
      let exerciseId = w.exerciseId;
      if (!exerciseId && w.customExerciseName.trim()) {
        exerciseId = await resolveOrCreateExercise(
          w.userId,
          w.customExerciseName,
          w.customMuscleGroup,
        );
      }
      if (!exerciseId) {
        // Sin ejercicio ni nombre resoluble: la entrada nunca podrá sincronizar,
        // pero la conservamos marcada como fallida en vez de borrarla.
        await markFailed(w, 'sin ejercicio resoluble');
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
        // El id de la entrada es estable entre reintentos: si un envío anterior
        // llegó a escribirse y solo se perdió la respuesta, el servidor lo
        // reconoce y no duplica el entreno.
        p_client_id: w.id,
      });
      if (rpcError) throw rpcError;

      await removeWorkout(w.id);
      flushed += 1;
    } catch (err) {
      const attempt = (w.retryCount ?? 0) + 1;
      w.retryCount = attempt;

      if (attempt >= MAX_RETRIES) {
        await markFailed(
          w,
          isNetworkError(err) ? `sin conexión tras ${MAX_RETRIES} intentos` : String(err),
        );
      } else {
        // Programar el siguiente reintento con backoff; el flush actual sigue
        // con las demás entradas (no cortamos el bucle).
        w.nextAttemptAt = now + retryDelay(attempt);
        await (await getDb()).put(STORE, w);
        devLog(`[workoutOutbox] reintento ${attempt}/${MAX_RETRIES} programado: ${w.id}`);
      }
    }
  }
  return flushed;
}
