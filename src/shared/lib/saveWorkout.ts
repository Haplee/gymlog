// Caso de uso: guardar un entreno, y si la red falla, encolarlo.
//
// Esta secuencia vivía duplicada en `workoutStore.saveWorkout` y en
// `routineSessionStore.finish`, con divergencias de detalle en cada copia. La
// prueba de que dolía: el fallo de entrenos duplicados por reenvío hubo que
// arreglarlo dos veces, una en cada fichero, y la segunda copia arrastraba
// además su propio desfase al decidir qué ejercicios reencolar.
//
// Aquí vive solo la decisión de red y persistencia. Los efectos de cada
// pantalla (limpiar el formulario, refrescar contadores, silenciar
// recordatorios) se quedan en sus stores, gobernados por el resultado.

import { supabase } from './supabase';
import { resolveOrCreateExercise } from './resolveOrCreateExercise';
import { enqueueWorkout, type OutboxSet } from './workoutOutbox';
import { isNetworkError } from './networkError';
import { isIdempotencyConflict, retryOnNetwork } from './idempotency';
import { devError } from './devtools';

export interface SaveWorkoutInput {
  /**
   * Clave de idempotencia del envío. La genera quien llama ANTES del primer
   * intento y no cambia entre reintentos: es lo que permite al servidor
   * reconocer un reenvío en vez de crear un entreno nuevo. También hace de id
   * de la entrada en el outbox.
   */
  clientId: string;
  userId: string;
  /** Id del catálogo si ya se conoce; si no, se resuelve por nombre. */
  exerciseId: string | null;
  customExerciseName: string;
  customMuscleGroup: string;
  startedAt: string;
  finishedAt: string;
  sets: OutboxSet[];
  notes?: string;
  rating?: number | null;
}

export type SaveWorkoutOutcome =
  /** Escrito en el servidor. */
  | { status: 'saved' }
  /** Sin conexión o red caída: guardado en la cola local, se subirá solo. */
  | { status: 'queued' }
  /** Fallo real (validación, permisos): ni se guardó ni se encoló. */
  | { status: 'error'; error: Error };

/** ¿El navegador dice que no hay red? En SSR/tests sin `navigator`, se asume que sí. */
function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

async function queue(input: SaveWorkoutInput): Promise<SaveWorkoutOutcome> {
  try {
    await enqueueWorkout({
      id: input.clientId,
      userId: input.userId,
      exerciseId: input.exerciseId,
      customExerciseName: input.customExerciseName.trim(),
      customMuscleGroup: input.customMuscleGroup,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      sets: input.sets,
      notes: input.notes,
      rating: input.rating,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // La cola local también puede fallar (IndexedDB bloqueado, cuota llena).
    // Esta función promete no lanzar nunca: quien la llama deja el guardado en
    // curso si el `await` revienta, y aquí además no queda nada guardado. Se
    // devuelve un fallo real para que la pantalla lo pueda contar.
    devError('[saveWorkout] no se pudo encolar el entreno', {
      clientId: input.clientId,
      exerciseId: input.exerciseId,
      phase: 'outbox',
      error: err,
    });
    return { status: 'error', error: withCause('workout.errors.queue_failed', err) };
  }
  return { status: 'queued' };
}

/**
 * Error con la causa original enganchada.
 *
 * La pantalla necesita el mensaje traducible, pero quien decide si un fallo es
 * un conflicto de idempotencia necesita el error real del servidor. Antes se
 * creaba un `Error` nuevo sin `cause`, así que el código P0001 se perdía por el
 * camino y un conflicto parecía un fallo genérico.
 */
function withCause(message: string, cause: unknown): Error {
  const error = new Error(message, { cause });
  const code = (cause as { code?: unknown } | null)?.code;
  if (typeof code === 'string') (error as Error & { code?: string }).code = code;
  return error;
}

/**
 * Guarda un entreno de un ejercicio. Nunca lanza: el resultado dice qué pasó.
 *
 * Sin conexión encola directamente, sin gastar el intento. El ejercicio que no
 * está en el catálogo se crea al vuelo, y si eso no es posible tampoco se
 * pierde nada: la entrada encolada guarda el nombre y se resuelve al sincronizar.
 */
export async function saveWorkoutOrQueue(input: SaveWorkoutInput): Promise<SaveWorkoutOutcome> {
  if (isOffline()) return queue(input);

  try {
    let exerciseId = input.exerciseId;
    if (!exerciseId && input.customExerciseName.trim()) {
      exerciseId = await resolveOrCreateExercise(
        input.userId,
        input.customExerciseName,
        input.customMuscleGroup,
      );
    }
    if (!exerciseId) {
      return { status: 'error', error: new Error('Selecciona un ejercicio') };
    }

    await retryOnNetwork(async () => {
      const { error } = await supabase.rpc('save_workout_with_sets', {
        p_user_id: input.userId,
        p_exercise_id: exerciseId,
        p_started_at: input.startedAt,
        p_finished_at: input.finishedAt,
        p_sets: input.sets,
        p_notes: input.notes,
        p_rating: input.rating ?? undefined,
        p_client_id: input.clientId,
      });
      // Supabase devuelve los errores en el resultado, no lanzándolos. Se
      // relanza para que el reintento y la clasificación vean el error real.
      if (error) throw error;
    });

    return { status: 'saved' };
  } catch (err) {
    // Una clave que ya existe con otro contenido es un fallo del cliente, no de
    // red: reintentarla daría el mismo rechazo. Se dice tal cual en vez de
    // fingir que se guardó.
    if (isIdempotencyConflict(err)) {
      return {
        status: 'error',
        error: withCause('workout.errors.idempotency_conflict', err),
      };
    }

    // La red se cayó a mitad: el entreno se conserva en la cola. Si el servidor
    // llegó a escribirlo y solo se perdió la respuesta, el reenvío trae el
    // mismo `clientId` y no duplica nada.
    if (isNetworkError(err)) return queue(input);

    return {
      status: 'error',
      error: err instanceof Error ? err : new Error('Error guardando'),
    };
  }
}
