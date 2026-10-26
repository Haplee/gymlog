/**
 * Lectura de todos los datos de la cuenta para el derecho de acceso y la
 * portabilidad (RGPD arts. 15 y 20).
 *
 * La app ya tenía una exportación, pero era la del historial: entrenos,
 * series, cardio y rutinas. Faltaba justo lo que más cuesta reconstruir si se
 * pierde la cuenta —perfil, medidas, sesiones de salud, dispositivos
 * conectados— y lo que el usuario no puede ver en ninguna pantalla.
 *
 * Todo se lee con la sesión del propio usuario: no hay `service_role` aquí. Si
 * una política RLS estuviera mal, esta consulta devolvería menos filas, no más.
 */

import type { User } from '@supabase/supabase-js';
import { supabase } from '@shared/lib/supabase';
import type { AccountSnapshot } from '../utils/fullExport';

/** El máximo por respuesta de PostgREST es 1000; pedimos la mitad y paginamos. */
const PAGE_SIZE = 500;

/** Tablas con `user_id` que deben estar siempre. Un fallo aquí aborta. */
const REQUIRED_USER_TABLES = [
  'body_measurements',
  'workouts',
  'personal_records',
  'exercises',
  'exercise_favorites',
  'exercise_goals',
  'exercise_notes',
  'exercise_progression',
  'progression_log',
  'user_routines',
  'cardio_sessions',
  'health_sessions',
  'wearable_connections',
  'wearable_daily',
  'wearable_sleep',
  'push_tokens',
] as const;

/**
 * Tablas que pueden no existir en una instalación concreta (por ejemplo, si el
 * entrenador se retiró y sus tablas se limpiaron). Su ausencia no puede impedir
 * exportar el resto; se anota en `errors` para que quede a la vista.
 */
const OPTIONAL_USER_TABLES = [
  'lift_analyses',
  'ai_coach_memory',
  'ai_coach_messages',
  'ai_coach_suggestions',
  'ai_coach_usage',
  'ai_coach_audit',
] as const;

interface QueryResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

interface QueryBuilder {
  select(columns?: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  in(column: string, values: unknown[]): QueryBuilder;
  range(from: number, to: number): PromiseLike<QueryResult>;
}

interface LooseClient {
  from(table: string): QueryBuilder;
}

const db = supabase as unknown as LooseClient;

/** Recorre una consulta ya filtrada hasta que una página llega incompleta. */
async function drain(
  build: (from: number, to: number) => PromiseLike<QueryResult>,
  label: string,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

function fetchByUser(table: string, userId: string): Promise<unknown[]> {
  return drain(
    (from, to) => db.from(table).select('*').eq('user_id', userId).range(from, to),
    table,
  );
}

/**
 * Las series no guardan `user_id`: cuelgan del entreno. Se piden por tandas de
 * 100 entrenos para no construir una URL con miles de identificadores.
 */
async function fetchWorkoutSets(workoutIds: string[]): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let i = 0; i < workoutIds.length; i += 100) {
    const chunk = workoutIds.slice(i, i + 100);
    const chunkRows = await drain(
      (from, to) => db.from('workout_sets').select('*').in('workout_id', chunk).range(from, to),
      'workout_sets',
    );
    rows.push(...chunkRows);
  }
  return rows;
}

/**
 * Los músculos de un ejercicio tampoco guardan `user_id`: cuelgan del ejercicio.
 * Solo se piden para los ejercicios personalizados del usuario, que son los que
 * devuelve la consulta anterior. Así no se exporta el catálogo global.
 */
async function fetchExerciseMuscles(exerciseIds: string[]): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let i = 0; i < exerciseIds.length; i += 100) {
    const chunk = exerciseIds.slice(i, i + 100);
    const chunkRows = await drain(
      (from, to) =>
        db.from('exercise_muscles').select('*').in('exercise_id', chunk).range(from, to),
      'exercise_muscles',
    );
    rows.push(...chunkRows);
  }
  return rows;
}

function idOf(row: unknown): string | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const id = (row as Record<string, unknown>).id;
  return typeof id === 'string' ? id : null;
}

/**
 * Lee todo lo del usuario. Lanza si falla una tabla obligatoria; las opcionales
 * se anotan y se sigue.
 */
export async function fetchAccountSnapshot(user: User): Promise<AccountSnapshot> {
  const tables: Record<string, unknown[]> = {};
  const errors: Record<string, string> = {};

  // El perfil se busca por `id`, no por `user_id`: es su propia clave.
  const profiles = await drain(
    (from, to) => db.from('profiles').select('*').eq('id', user.id).range(from, to),
    'profiles',
  );
  tables.profiles = profiles;

  const results = await Promise.all(
    REQUIRED_USER_TABLES.map(async (table) => ({
      table,
      rows: await fetchByUser(table, user.id),
    })),
  );
  for (const { table, rows } of results) tables[table] = rows;

  const workouts = tables.workouts ?? [];
  const workoutIds = workouts.map(idOf).filter((id): id is string => !!id);
  tables.workout_sets = await fetchWorkoutSets(workoutIds);

  const exercises = tables.exercises ?? [];
  const exerciseIds = exercises.map(idOf).filter((id): id is string => !!id);
  tables.exercise_muscles = await fetchExerciseMuscles(exerciseIds);

  for (const table of OPTIONAL_USER_TABLES) {
    try {
      tables[table] = await fetchByUser(table, user.id);
    } catch (err) {
      errors[table] = err instanceof Error ? err.message : String(err);
    }
  }

  const profile = profiles[0];
  const avatarUrl =
    profile && typeof profile === 'object' && !Array.isArray(profile)
      ? (((profile as Record<string, unknown>).avatar_url as string | null | undefined) ?? null)
      : null;

  return { tables, errors, avatarUrl };
}

/**
 * Pide el borrado de la cuenta.
 *
 * El cliente no puede borrar su propia fila de `auth.users` (ni debe poder):
 * lo hace la Edge Function `delete-account` con `service_role`, después de
 * verificar el JWT de esta misma sesión.
 */
export async function requestAccountDeletion(): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });

  if (error) return { error: error.message };
  const payload = data as { error?: string } | null;
  if (payload?.error) return { error: payload.error };
  return { error: null };
}
