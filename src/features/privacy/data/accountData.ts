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

// ---------------------------------------------------------------------------
// Recuento y borrado por categorías
// ---------------------------------------------------------------------------

/**
 * Categorías que el usuario puede borrar por separado.
 *
 * No son «tablas»: son cosas que la persona reconoce («mi historial», «mis
 * medidas»). Una categoría puede tocar varias tablas y el orden importa.
 *
 * Lo que **no** entra aquí, a propósito:
 * - `exercises`: los ejercicios personalizados pueden estar referenciados por
 *   series guardadas (`ON DELETE RESTRICT`). Borrarlos en bloque fallaría o
 *   rompería entrenos que el usuario ha decidido conservar.
 * - La cuenta entera: tiene su propio flujo, con verificación en servidor.
 */
export const DATA_CATEGORY_TABLES = {
  workouts: ['personal_records', 'workouts'],
  measurements: ['body_measurements'],
  cardio: ['cardio_sessions'],
  health: ['health_sessions', 'wearable_daily', 'wearable_sleep', 'wearable_connections'],
  routines: ['user_routines'],
  exerciseMeta: [
    'exercise_favorites',
    'exercise_goals',
    'exercise_notes',
    'exercise_progression',
    'progression_log',
  ],
  coach: [
    'lift_analyses',
    'ai_coach_memory',
    'ai_coach_messages',
    'ai_coach_suggestions',
    'ai_coach_usage',
    'ai_coach_audit',
  ],
  devices: ['push_tokens'],
} as const satisfies Record<string, readonly string[]>;

export type DataCategoryId = keyof typeof DATA_CATEGORY_TABLES;

export const DATA_CATEGORY_IDS = Object.keys(DATA_CATEGORY_TABLES) as DataCategoryId[];

export interface AccountCounts {
  /** Filas por tabla. Una tabla que no existe no aparece. */
  counts: Record<string, number>;
  /** Tablas que fallaron al contar, con el motivo. */
  errors: Record<string, string>;
}

/**
 * Nombres de todos los ejercicios visibles para el usuario (catálogo público +
 * los suyos). La exportación completa solo trae los ejercicios propios porque
 * el catálogo no es dato del usuario; el CSV, en cambio, necesita poner nombre
 * a cada serie y el id no le dice nada a quien lo abre.
 */
export async function fetchExerciseNames(): Promise<Record<string, string>> {
  const rows = await drain(
    (from, to) => db.from('exercises').select('id,name').range(from, to),
    'exercises',
  );
  const names: Record<string, string> = {};
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const { id, name } = row as { id?: unknown; name?: unknown };
    if (typeof id === 'string' && typeof name === 'string') names[id] = name;
  }
  return names;
}

interface CountResult {
  count: number | null;
  error: { message: string } | null;
}

interface CountQuery extends PromiseLike<CountResult> {
  eq(column: string, value: unknown): CountQuery;
}

interface CountClient {
  from(table: string): {
    select(columns?: string, options?: { count?: 'exact'; head?: boolean }): CountQuery;
  };
}

const countDb = supabase as unknown as CountClient;

/**
 * Cuenta las filas de cada tabla sin traerlas.
 *
 * `head: true` hace que PostgREST devuelva solo la cabecera con `Content-Range`:
 * el centro puede enseñar «48 entrenos» sin descargar 48 entrenos ni sus series.
 */
export async function fetchAccountCounts(userId: string): Promise<AccountCounts> {
  const counts: Record<string, number> = {};
  const errors: Record<string, string> = {};

  await Promise.all(
    DATA_CATEGORY_IDS.map(async (category) => {
      await Promise.all(
        DATA_CATEGORY_TABLES[category].map(async (table) => {
          const { count, error } = await countDb
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
          if (error) {
            // Una tabla opcional que ya no existe no es un fallo del recuento:
            // es una función retirada. Solo se avisa de las obligatorias.
            const optional = (OPTIONAL_USER_TABLES as readonly string[]).includes(table);
            if (!optional) errors[table] = error.message;
          } else {
            counts[table] = count ?? 0;
          }
        }),
      );
    }),
  );

  return { counts, errors };
}

interface DeleteResult {
  count: number | null;
  error: { message: string } | null;
}

interface DeleteQuery extends PromiseLike<DeleteResult> {
  eq(column: string, value: unknown): DeleteQuery;
}

interface DeleteClient {
  from(table: string): {
    delete(options?: { count?: 'exact' }): DeleteQuery;
  };
}

const deleteDb = supabase as unknown as DeleteClient;

export interface DeleteCategoryResult {
  /** Filas borradas por tabla. `null` si esa tabla falló. */
  deleted: Record<string, number | null>;
  /** Tablas que no se pudieron borrar, con el motivo. */
  errors: Record<string, string>;
}

/**
 * Borra una categoría de datos del usuario en sesión.
 *
 * Va tabla por tabla y **no** se detiene en el primer fallo: si RLS impide
 * tocar una tabla, el resto del borrado sigue y el resultado dice exactamente
 * qué quedó sin borrar. Un «hecho» genérico con datos a medias es peor que un
 * error explícito.
 *
 * La sesión del cliente solo puede borrar sus propias filas (`user_id =
 * auth.uid()`); no hay `service_role` ni se acepta un id ajeno.
 */
export async function deleteDataCategory(
  category: DataCategoryId,
  userId: string,
): Promise<DeleteCategoryResult> {
  const deleted: Record<string, number | null> = {};
  const errors: Record<string, string> = {};

  for (const table of DATA_CATEGORY_TABLES[category]) {
    const { count, error } = await deleteDb
      .from(table)
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    if (error) {
      deleted[table] = null;
      errors[table] = error.message;
    } else {
      deleted[table] = count ?? 0;
    }
  }

  return { deleted, errors };
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
 * Estado real del borrado de cuenta en el servidor.
 *
 * La Edge Function existía en el repositorio pero no estaba desplegada. La
 * interfaz no puede prometer un botón que devuelve 404. Se comprueba con un
 * `GET`: el código de la función responde `405 method_not_allowed` cuando está
 * desplegada (solo acepta POST) y el gateway responde `404` cuando no existe.
 * Es una petición sin cuerpo y sin efecto: no borra nada.
 */
export type AccountDeletionAvailability = 'available' | 'not-deployed' | 'unknown';

export async function checkAccountDeletionAvailability(): Promise<AccountDeletionAvailability> {
  try {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'GET' });
    if (!error) return 'unknown';
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 405) return 'available';
    if (status === 404) return 'not-deployed';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export interface AccountDeletionResult {
  error: string | null;
  /**
   * `not-deployed` cuando la función no existe en el proyecto: no es un fallo
   * transitorio y reintentar no va a arreglarlo. La interfaz lo dice tal cual
   * en vez de culpar a la red.
   */
  reason?: 'not-deployed' | 'failed';
}

/**
 * Pide el borrado de la cuenta.
 *
 * El cliente no puede borrar su propia fila de `auth.users` (ni debe poder):
 * lo hace la Edge Function `delete-account` con `service_role`, después de
 * verificar el JWT de esta misma sesión. Si la función no está desplegada, esta
 * llamada no borra nada y la interfaz debe ofrecer la vía alternativa.
 */
export async function requestAccountDeletion(): Promise<AccountDeletionResult> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    return {
      error: error.message,
      reason: status === 404 ? 'not-deployed' : 'failed',
    };
  }
  const payload = data as { error?: string } | null;
  if (payload?.error) return { error: payload.error, reason: 'failed' };
  return { error: null };
}
