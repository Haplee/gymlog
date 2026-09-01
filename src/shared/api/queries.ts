import { supabase } from '@shared/lib/supabase';
import { devError, devWarn } from '@shared/lib/devtools';
import { parseRemoteWorkouts } from './schemas';
import { groupSetsBySession } from './sessionGrouping';
import type { ExerciseSessionSets } from './sessionGrouping';
import { toLocalDateKey } from '@shared/lib/dateKeys';
import type {
  WorkoutWithSets,
  WorkoutSetWithDetails,
  PersonalRecord,
  Exercise,
  ExerciseNote,
  ExerciseMuscle,
} from '@shared/lib/types';

/**
 * Resuelve workouts + sets anidados en una sola llamada RPC (join en servidor),
 * evitando el patrón cliente `.in('workout_id', [muchos UUIDs])` que puede
 * superar el límite de longitud de URL de PostgREST en historiales grandes.
 *
 * Fallback al doble round-trip clásico si la RPC no existe (deploys antiguos).
 */
const fetchWorkoutsWithSets = async (
  userId: string,
  limit: number,
  cursor: string | null = null,
): Promise<WorkoutWithSets[]> => {
  const { data, error } = await supabase.rpc('get_workouts_with_sets', {
    p_user_id: userId,
    p_limit: limit,
    p_cursor: cursor,
  });

  if (error) {
    devWarn('[fetchWorkoutsWithSets] RPC failed, falling back to legacy:', error.message);
    return legacyFetchWorkoutsWithSets(userId, limit, cursor);
  }

  return parseRemoteWorkouts(data);
};

/** Camino legacy: workouts + sets en dos queries con `.in` (solo fallback). */
const legacyFetchWorkoutsWithSets = async (
  userId: string,
  limit: number,
  cursor: string | null = null,
): Promise<WorkoutWithSets[]> => {
  let query = supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (cursor) query = query.lt('started_at', cursor);

  const { data: workouts, error } = await query;
  if (error) throw error;
  if (!workouts || workouts.length === 0) return [];

  const ids = workouts.map((w) => w.id);

  const { data: allSets, error: setsError } = await supabase
    .from('workout_sets')
    .select(
      // `rir` va aquí porque la RPC lo devuelve desde
      // 20260805120000_get_workouts_with_sets_include_rir: sin él, el respaldo
      // servía series con menos señal de esfuerzo que el camino principal, y la
      // autorregulación salía distinta según por qué rama se hubiera entrado.
      'id, weight, reps, set_num, exercise_id, workout_id, created_at, notes, is_warmup, rpe, rir, exercise:exercises(name, muscle_group), workout:workouts(started_at)',
    )
    .in('workout_id', ids)
    .order('created_at', { ascending: false });

  if (setsError) throw setsError;

  // Mismo validador que el camino de la RPC: el fallback no puede tener menos
  // garantías que el principal solo por ser el fallback.
  return parseRemoteWorkouts(
    workouts.map((wo) => ({ ...wo, sets: (allSets || []).filter((s) => s.workout_id === wo.id) })),
  );
};

/**
 * Obtiene workouts con sus sets asociados para un usuario
 * @param userId - ID del usuario
 * @param limit - Límite de workouts (default 200)
 * @returns Objeto con workouts y sets
 */
export const fetchWorkoutsAndSets = async (userId: string, limit = 200) => {
  try {
    const workouts = await fetchWorkoutsWithSets(userId, limit);
    const sets = workouts.flatMap((w) => w.sets as WorkoutSetWithDetails[]);
    return { workouts, sets };
  } catch (err) {
    devError('fetchWorkoutsAndSets error:', err);
    throw err;
  }
};

export interface PaginatedWorkoutsResponse {
  workouts: WorkoutWithSets[];
  nextCursor: string | null;
}

export const fetchWorkoutsPaginated = async (
  userId: string,
  cursor: string | null = null,
  limit = 20,
): Promise<PaginatedWorkoutsResponse> => {
  const workouts = await fetchWorkoutsWithSets(userId, limit, cursor);
  if (workouts.length === 0) return { workouts: [], nextCursor: null };

  const nextCursor =
    workouts.length === limit ? (workouts[workouts.length - 1]?.started_at ?? null) : null;

  return { workouts, nextCursor };
};

export const fetchWorkouts = async (userId: string, limit = 1000): Promise<WorkoutWithSets[]> => {
  return fetchWorkoutsWithSets(userId, limit);
};

export const fetchRecentSets = async (
  userId: string,
  limit = 1000,
): Promise<WorkoutSetWithDetails[]> => {
  try {
    const workouts = await fetchWorkoutsWithSets(userId, 300);
    const sets = workouts
      .flatMap((w) => w.sets as WorkoutSetWithDetails[])
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    return sets.slice(0, limit);
  } catch (err) {
    devError('fetchRecentSets error:', err);
    throw err;
  }
};

export const fetchExercises = async (userId: string | undefined): Promise<Exercise[]> => {
  if (!userId) {
    const { data, error } = await supabase.from('exercises').select('*').order('name');
    if (error) throw error;
    return (data as Exercise[]) || [];
  }

  // Single RPC: exercises (own + public) + usage_count, sorted by usage desc.
  const { data, error } = await supabase.rpc('get_exercises_with_usage', { p_user_id: userId });
  if (error) {
    // Fallback: simple select if RPC missing (older deployments)
    devWarn('[fetchExercises] RPC failed, falling back:', error.message);
    const { data: rows, error: fbErr } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, user_id, created_at, equipment')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('name');
    if (fbErr) throw fbErr;
    return (rows || []) as Exercise[];
  }
  return (data || []) as Exercise[];
};

/** Lee los músculos ponderados de un ejercicio (primario primero). */
export async function fetchExerciseMuscles(exerciseId: string): Promise<ExerciseMuscle[]> {
  const { data, error } = await supabase
    .from('exercise_muscles')
    .select('muscle_group, role, weight')
    .eq('exercise_id', exerciseId);
  if (error) throw error;
  const rows = (data ?? []) as ExerciseMuscle[];
  return rows.toSorted((a, b) => (a.role === 'primary' ? -1 : b.role === 'primary' ? 1 : 0));
}

/**
 * Mapa masivo `exercise_id → músculos ponderados` para todos los ejercicios
 * visibles (propios + públicos; RLS lo garantiza). Una sola consulta, sin N+1.
 */
export async function fetchExerciseMusclesMap(
  _userId: string,
): Promise<Record<string, ExerciseMuscle[]>> {
  const { data, error } = await supabase
    .from('exercise_muscles')
    .select('exercise_id, muscle_group, role, weight');
  if (error) throw error;
  const map: Record<string, ExerciseMuscle[]> = {};
  for (const row of (data ?? []) as (ExerciseMuscle & { exercise_id: string })[]) {
    (map[row.exercise_id] ??= []).push({
      muscle_group: row.muscle_group,
      role: row.role,
      weight: row.weight,
    });
  }
  return map;
}

export const fetchPersonalRecords = async (userId: string): Promise<PersonalRecord[]> => {
  const { data, error } = await supabase
    .from('personal_records')
    .select('id, user_id, exercise_id, weight, reps, one_rm, rep_band, workout_set_id, achieved_at')
    .eq('user_id', userId);

  if (error) {
    devError('Error fetching personal records:', error);
    throw error;
  }
  return (data as PersonalRecord[]) || [];
};

export const fetchExerciseNotes = async (
  userId: string,
  exerciseId: string,
): Promise<ExerciseNote[]> => {
  const { data, error } = await supabase
    .from('exercise_notes')
    .select('*')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as ExerciseNote[]) || [];
};

export const saveExerciseNote = async (
  userId: string,
  exerciseId: string,
  note: string,
): Promise<ExerciseNote> => {
  const { data, error } = await supabase
    .from('exercise_notes')
    .insert({ user_id: userId, exercise_id: exerciseId, note })
    .select()
    .single();

  if (error) throw error;
  return data as ExerciseNote;
};

export const deleteExerciseNote = async (noteId: string): Promise<void> => {
  const { error } = await supabase.from('exercise_notes').delete().eq('id', noteId);
  if (error) throw error;
};

export const deleteExercise = async (exerciseId: string): Promise<void> => {
  const { error } = await supabase.from('exercises').delete().eq('id', exerciseId);
  if (error) throw error;
};

/**
 * Entrenos recientes que se miran para reconstruir el historial de UN ejercicio.
 *
 * La misma para todas las consultas de historial por ejercicio a propósito:
 * cuando esta miraba 30 entrenos y el motor de sugerencia 40, había ejercicios
 * con recomendación pero sin tarjeta de "última sesión". Como se guarda un
 * entreno por ejercicio, 60 son unos 12 días de entreno reales.
 */
const RECENT_WORKOUTS_WINDOW = 60;

export const fetchLastExerciseSets = async (
  userId: string,
  exerciseId: string,
): Promise<
  { reps: number; weight: number; set_num: number; workout_started_at: string | null }[]
> => {
  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(RECENT_WORKOUTS_WINDOW);

  if (!workouts?.length) return [];

  // Los calentamientos se descartan en el servidor, igual que en
  // `fetchExerciseSessions`: mezclados con las series de trabajo, la tarjeta
  // mostraba «60×8 80×6 100×5 100×5 110×5 110×5» y parecía un montón de pesos
  // sin relación entre sí.
  const { data: sets } = await supabase
    .from('workout_sets')
    .select('workout_id, reps, weight, set_num')
    .eq('exercise_id', exerciseId)
    .eq('is_warmup', false)
    .in(
      'workout_id',
      workouts.map((w) => w.id),
    );

  if (!sets?.length) return [];

  // El día entero, no el último entreno: se guarda un entreno por ejercicio, y
  // el 6-ago hubo Remo con barra a 60 kg y a 80 kg en la misma sesión. La
  // tarjeta enseñaba solo el de 60 mientras el motor recomendaba sobre el de 80,
  // que es la misma incoherencia que agrupar por día arregló en la sugerencia.
  return groupSetsByLastDay(sets, workouts);
};

/** Series de trabajo del día más reciente en que se entrenó el ejercicio. */
const groupSetsByLastDay = (
  sets: { workout_id: string; reps: number; weight: number; set_num: number }[],
  workouts: { id: string; started_at: string | null }[],
): { reps: number; weight: number; set_num: number; workout_started_at: string | null }[] => {
  const startedAt = new Map(workouts.map((w) => [w.id, w.started_at]));

  const dated = sets.flatMap((s) => {
    const date = startedAt.get(s.workout_id);
    if (!date) return [];
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return [];
    return [{ ...s, date, dayKey: toLocalDateKey(parsed) }];
  });
  if (dated.length === 0) return [];

  const lastDay = dated.reduce((a, b) => (b.dayKey > a.dayKey ? b : a)).dayKey;
  const ofDay = dated.filter((s) => s.dayKey === lastDay);

  // Dentro del día, en el orden en que se entrenó.
  ofDay.sort((a, b) => a.date.localeCompare(b.date) || a.set_num - b.set_num);

  const dayStart = ofDay[0].date;
  return ofDay.map(({ reps, weight, set_num }) => ({
    reps,
    weight,
    set_num,
    workout_started_at: dayStart,
  }));
};

/**
 * Últimas sesiones de UN ejercicio, para el motor de autorregulación.
 *
 * `fetchLastExerciseSets` devuelve solo la última sesión y sin RIR/RPE, que es
 * lo que necesita la tarjeta de "repetir lo de la otra vez". Decidir si toca
 * subir carga necesita varias sesiones y el esfuerzo declarado, de ahí esta
 * consulta aparte en lugar de engordar aquella.
 *
 * Los calentamientos se descartan en el servidor: no dicen nada del esfuerzo.
 */
export const fetchExerciseSessions = async (
  userId: string,
  exerciseId: string,
  sessionLimit = 8,
): Promise<ExerciseSessionSets[]> => {
  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(RECENT_WORKOUTS_WINDOW);

  if (!workouts?.length) return [];

  const { data: sets } = await supabase
    .from('workout_sets')
    .select('workout_id, weight, reps, rir, rpe')
    .eq('exercise_id', exerciseId)
    .eq('is_warmup', false)
    .in(
      'workout_id',
      workouts.map((w) => w.id),
    );

  if (!sets?.length) return [];

  return groupSetsBySession(sets, workouts, sessionLimit);
};

/** Serie dura reciente, reducida a lo que necesita el contexto de volumen. */
export interface RecentMuscleSet {
  date: string;
  muscleGroup: string;
}

/**
 * Series duras de las últimas semanas con su grupo muscular.
 *
 * La pantalla de entreno decide la carga de UN ejercicio, pero para saber si
 * toca subirla hace falta cuánto trabajo lleva ese músculo en la semana. Traer
 * el historial entero para eso sería absurdo en la pantalla que más se abre, así
 * que esta consulta baja solo dos columnas y la ventana justa.
 */
export const fetchRecentMuscleSets = async (
  userId: string,
  days = 28,
): Promise<RecentMuscleSet[]> => {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, started_at')
    .eq('user_id', userId)
    .gte('started_at', since)
    .order('started_at', { ascending: false });

  if (!workouts?.length) return [];

  const dateById = new Map(workouts.map((w) => [w.id, w.started_at]));
  const { data: sets } = await supabase
    .from('workout_sets')
    .select('workout_id, exercise:exercises(muscle_group)')
    .eq('is_warmup', false)
    .in(
      'workout_id',
      workouts.map((w) => w.id),
    );

  if (!sets?.length) return [];

  return sets.flatMap((row) => {
    const date = dateById.get(row.workout_id);
    // El join embebido llega como objeto o como array de un elemento según lo
    // que infiera el cliente; se normalizan los dos casos.
    const joined = Array.isArray(row.exercise) ? row.exercise[0] : row.exercise;
    const muscleGroup = joined?.muscle_group;
    return date && muscleGroup ? [{ date, muscleGroup }] : [];
  });
};

export interface LibraryExercise {
  id: string;
  name: string;
  muscle_group: string;
  muscle_detail: string | null;
  equipment: string | null;
  movement: string | null;
  description: string | null;
  media_url: string | null;
  is_compound: boolean | null;
  /** Modalidad de carga: 'external' | 'bodyweight' | 'bodyweight_loaded'. */
  load_type: string | null;
}

export const fetchExerciseLibrary = async (
  userId: string | undefined,
): Promise<LibraryExercise[]> => {
  let query = supabase
    .from('exercises')
    .select(
      'id, name, muscle_group, muscle_detail, equipment, movement, description, media_url, is_compound, load_type',
    )
    .order('name');
  if (userId) {
    query = query.or(`user_id.eq.${userId},user_id.is.null`);
  }
  const { data, error } = await query;
  if (error) {
    devError('Error fetching exercise library:', error);
    throw error;
  }
  return (data as LibraryExercise[]) || [];
};

/**
 * IDs de los ejercicios marcados como favoritos.
 *
 * Devuelve lista vacía si la tabla aún no existe (migración
 * 20260723150000_exercise_favorites sin aplicar): así la estrella no rompe la
 * pantalla en un entorno que todavía no la tiene.
 */
export const fetchFavoriteExerciseIds = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('exercise_favorites')
    .select('exercise_id')
    .eq('user_id', userId);
  if (error) {
    devError('Error fetching favorites:', error);
    return [];
  }
  return (data ?? []).map((r) => r.exercise_id as string);
};

/** Marca o desmarca un favorito. Devuelve el estado resultante. */
export const toggleFavoriteExercise = async (
  userId: string,
  exerciseId: string,
  isFavorite: boolean,
): Promise<boolean> => {
  if (isFavorite) {
    const { error } = await supabase
      .from('exercise_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase
    .from('exercise_favorites')
    .insert({ user_id: userId, exercise_id: exerciseId });
  if (error) throw error;
  return true;
};

export interface BodyMeasurement {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  notes: string | null;
  created_at: string | null;
}

export const fetchBodyMeasurements = async (userId: string): Promise<BodyMeasurement[]> => {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('id, user_id, date, weight_kg, body_fat_pct, muscle_mass_kg, notes, created_at')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  if (error) {
    devError('Error fetching body measurements:', error);
    throw error;
  }
  return (data as BodyMeasurement[]) || [];
};

export const addBodyMeasurement = async (
  userId: string,
  values: { weight_kg: number | null; body_fat_pct: number | null },
): Promise<BodyMeasurement> => {
  const { data, error } = await supabase
    .from('body_measurements')
    .insert({
      user_id: userId,
      date: new Date().toISOString().split('T')[0],
      weight_kg: values.weight_kg,
      body_fat_pct: values.body_fat_pct,
    })
    .select('id, user_id, date, weight_kg, body_fat_pct, muscle_mass_kg, notes, created_at')
    .single();
  if (error) throw error;
  return data as BodyMeasurement;
};

/** Guarda (o actualiza) el peso corporal de hoy. Upsert por (user_id, date). */
export const upsertTodayWeight = async (userId: string, weightKg: number): Promise<void> => {
  // Fecha local, no UTC: pesarse un lunes a las 00:30 en España se guardaba con
  // fecha de domingo, y el aviso semanal (que solo sale los lunes) volvía a
  // salir por no encontrar registro de ese lunes.
  const today = toLocalDateKey(new Date());
  const { error } = await supabase
    .from('body_measurements')
    .upsert({ user_id: userId, date: today, weight_kg: weightKg }, { onConflict: 'user_id,date' });
  if (error) throw error;
};

/**
 * Guarda en bloque los pesos importados desde otra app.
 *
 * **Solo rellena huecos.** Un día que ya tiene peso en GymLog no se toca, por
 * dos motivos: lo que el usuario apuntó aquí a mano es el dato en el que más
 * confía, y `body_measurements` guarda además grasa y masa muscular en la misma
 * fila — un upsert las dejaría a null sin que nadie lo hubiera pedido.
 *
 * Devuelve cuántos entraron y cuántos se saltaron, para poder decirlo en vez de
 * dar un «listo» que esconde la mitad.
 */
export const insertMissingWeights = async (
  userId: string,
  weights: { date: string; weightKg: number }[],
): Promise<{ inserted: number; skipped: number }> => {
  if (weights.length === 0) return { inserted: 0, skipped: 0 };

  const { data: existentes, error: errorLectura } = await supabase
    .from('body_measurements')
    .select('date')
    .eq('user_id', userId)
    .not('weight_kg', 'is', null);
  if (errorLectura) throw errorLectura;

  const yaHay = new Set((existentes ?? []).map((m) => m.date));
  const nuevos = weights.filter((w) => !yaHay.has(w.date));
  const skipped = weights.length - nuevos.length;
  if (nuevos.length === 0) return { inserted: 0, skipped };

  // Por lotes: un historial de años son miles de filas y una sola petición con
  // todas se queda sin aire (límite de tamaño del cuerpo y timeout).
  const LOTE = 500;
  let inserted = 0;
  for (let i = 0; i < nuevos.length; i += LOTE) {
    const lote = nuevos.slice(i, i + LOTE).map((w) => ({
      user_id: userId,
      date: w.date,
      weight_kg: w.weightKg,
    }));
    const { error } = await supabase.from('body_measurements').insert(lote);
    if (error) throw error;
    inserted += lote.length;
  }

  return { inserted, skipped };
};

export const deleteBodyMeasurement = async (id: string): Promise<void> => {
  const { error } = await supabase.from('body_measurements').delete().eq('id', id);
  if (error) throw error;
};

export interface ExerciseGoal {
  id: string;
  exercise_id: string;
  target_one_rm: number;
}

export const fetchExerciseGoals = async (userId: string): Promise<ExerciseGoal[]> => {
  const { data, error } = await supabase
    .from('exercise_goals')
    .select('id, exercise_id, target_one_rm')
    .eq('user_id', userId);
  if (error) {
    // Tabla puede no existir aún (migración sin aplicar) — degradar a vacío.
    devWarn('[Goals] fetch error:', error.message);
    return [];
  }
  return (data as ExerciseGoal[]) ?? [];
};

export const upsertExerciseGoal = async (
  userId: string,
  exerciseId: string,
  targetOneRm: number,
): Promise<void> => {
  const { error } = await supabase
    .from('exercise_goals')
    .upsert(
      { user_id: userId, exercise_id: exerciseId, target_one_rm: targetOneRm },
      { onConflict: 'user_id,exercise_id' },
    );
  if (error) throw error;
};

export const deleteExerciseGoal = async (userId: string, exerciseId: string): Promise<void> => {
  const { error } = await supabase
    .from('exercise_goals')
    .delete()
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId);
  if (error) throw error;
};

export const fetchVolumeByMuscleGroup = async (
  userId: string,
): Promise<{ muscle_group: string; total_volume: number }[]> => {
  const { data, error } = await supabase.rpc('get_volume_by_muscle_group', { user_uuid: userId });
  if (error) {
    devError('[Volume] Error fetching volume:', error);
    throw error;
  }
  return data || [];
};
