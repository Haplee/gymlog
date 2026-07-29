import { supabase } from '@shared/lib/supabase';
import { devError, devWarn } from '@shared/lib/devtools';
import type {
  WorkoutWithSets,
  WorkoutSetWithDetails,
  PersonalRecord,
  Exercise,
  ExerciseNote,
} from '@shared/lib/types';

const mapWorkout = (wo: Record<string, unknown>): WorkoutWithSets =>
  ({
    ...wo,
    started_at: wo.started_at,
    ended_at: wo.finished_at,
    sets: (wo.sets as WorkoutSetWithDetails[]) ?? [],
  }) as unknown as WorkoutWithSets;

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

  return ((data as Record<string, unknown>[]) || []).map(mapWorkout);
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
      'id, weight, reps, set_num, exercise_id, workout_id, created_at, notes, is_warmup, rpe, exercise:exercises(name, muscle_group), workout:workouts(started_at)',
    )
    .in('workout_id', ids)
    .order('created_at', { ascending: false });

  if (setsError) throw setsError;

  return workouts.map((wo) =>
    mapWorkout({ ...wo, sets: (allSets || []).filter((s) => s.workout_id === wo.id) }),
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
    .limit(30);

  if (!workouts?.length) return [];

  const workoutIds = workouts.map((w) => w.id);

  const { data: latestSet } = await supabase
    .from('workout_sets')
    .select('workout_id')
    .eq('exercise_id', exerciseId)
    .in('workout_id', workoutIds)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSet?.workout_id) return [];

  const workoutInfo = workouts.find((w) => w.id === latestSet.workout_id);

  const { data: sets } = await supabase
    .from('workout_sets')
    .select('reps, weight, set_num')
    .eq('workout_id', latestSet.workout_id)
    .eq('exercise_id', exerciseId)
    .order('set_num');

  return (sets || []).map((s) => ({
    ...s,
    workout_started_at: workoutInfo?.started_at ?? null,
  }));
};

/** Una sesión pasada de un ejercicio, con el esfuerzo que se registró. */
export interface ExerciseSessionSets {
  started_at: string;
  sets: { weight: number; reps: number; rir: number | null; rpe: number | null }[];
}

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
    .limit(40);

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

/**
 * Agrupa series sueltas en sesiones por entreno.
 *
 * Va aparte de la consulta para poder probarla: la parte que se puede
 * equivocar (huecos de fecha, orden, recorte) es esta, no el `select`.
 */
export const groupSetsBySession = (
  sets: {
    workout_id: string;
    weight: number;
    reps: number;
    rir: number | null;
    rpe: number | null;
  }[],
  workouts: { id: string; started_at: string | null }[],
  sessionLimit: number,
): ExerciseSessionSets[] => {
  const startedAt = new Map(workouts.map((w) => [w.id, w.started_at]));
  const byWorkout = new Map<string, ExerciseSessionSets>();

  for (const s of sets) {
    // Un entreno sin fecha no se puede ordenar ni medir: fuera. Sin esto, el
    // motor calcularía huecos entre sesiones con una fecha inventada.
    const date = startedAt.get(s.workout_id);
    if (!date) continue;
    const session = byWorkout.get(s.workout_id);
    const entry = { weight: s.weight, reps: s.reps, rir: s.rir, rpe: s.rpe };
    if (session) session.sets.push(entry);
    else byWorkout.set(s.workout_id, { started_at: date, sets: [entry] });
  }

  // Más reciente primero, igual que el resto de consultas de historial.
  return [...byWorkout.values()]
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, sessionLimit);
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
}

export const fetchExerciseLibrary = async (
  userId: string | undefined,
): Promise<LibraryExercise[]> => {
  let query = supabase
    .from('exercises')
    .select(
      'id, name, muscle_group, muscle_detail, equipment, movement, description, media_url, is_compound',
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
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase
    .from('body_measurements')
    .upsert({ user_id: userId, date: today, weight_kg: weightKg }, { onConflict: 'user_id,date' });
  if (error) throw error;
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
