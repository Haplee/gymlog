import { supabase } from '@shared/lib/supabase';
import type {
  WorkoutWithSets,
  WorkoutSetWithDetails,
  PersonalRecord,
  Exercise,
  ExerciseNote,
} from '@shared/lib/types';

/**
 * Obtiene workouts con sus sets asociados para un usuario
 * @param userId - ID del usuario
 * @param limit - Límite de workouts (default 200)
 * @returns Objeto con workouts y sets
 */
export const fetchWorkoutsAndSets = async (userId: string, limit = 200) => {
  try {
    const { data: workoutIds, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching workouts:', error);
      throw error;
    }
    if (!workoutIds || workoutIds.length === 0) return { workouts: [], sets: [] };

    const ids = workoutIds.map((w) => w.id);

    const { data: allSets, error: setsError } = await supabase
      .from('workout_sets')
      .select(
        'id, weight, reps, set_num, exercise_id, workout_id, created_at, notes, is_warmup, rpe, exercise:exercises(name, muscle_group), workout:workouts(started_at)',
      )
      .in('workout_id', ids)
      .order('created_at', { ascending: false });

    if (setsError) {
      console.error('Error fetching sets:', setsError);
      throw setsError;
    }

    const workouts: WorkoutWithSets[] = workoutIds.map((wo) => {
      const sets = (allSets || []).filter((s) => s.workout_id === wo.id);
      return {
        ...wo,
        started_at: wo.started_at,
        ended_at: wo.finished_at,
        sets: sets as unknown as WorkoutSetWithDetails[],
      } as WorkoutWithSets;
    });

    return { workouts, sets: (allSets as unknown as WorkoutSetWithDetails[]) || [] };
  } catch (err) {
    console.error('fetchWorkoutsAndSets error:', err);
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
  let query = supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('started_at', cursor);
  }

  const { data: workouts, error } = await query;

  if (error) throw error;
  if (!workouts || workouts.length === 0) return { workouts: [], nextCursor: null };

  const ids = workouts.map((w) => w.id);

  const { data: allSets, error: setsError } = await supabase
    .from('workout_sets')
    .select(
      'id, weight, reps, set_num, exercise_id, workout_id, created_at, notes, is_warmup, rpe, exercise:exercises(name)',
    )
    .in('workout_id', ids);

  if (setsError) throw setsError;

  const mappedWorkouts = workouts.map((wo) => {
    const sets = (allSets || []).filter((s) => s.workout_id === wo.id);
    return {
      ...wo,
      started_at: wo.started_at,
      ended_at: wo.finished_at,
      sets: sets as unknown as WorkoutSetWithDetails[],
    } as unknown as WorkoutWithSets;
  });

  const nextCursor =
    workouts.length === limit ? (workouts[workouts.length - 1]?.started_at ?? null) : null;

  return { workouts: mappedWorkouts, nextCursor };
};

export const fetchWorkouts = async (userId: string, limit = 1000): Promise<WorkoutWithSets[]> => {
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!workouts || workouts.length === 0) return [];

  const ids = workouts.map((w) => w.id);

  const { data: allSets, error: setsError } = await supabase
    .from('workout_sets')
    .select(
      'id, weight, reps, set_num, exercise_id, workout_id, created_at, notes, is_warmup, rpe, exercise:exercises(name)',
    )
    .in('workout_id', ids);

  if (setsError) throw setsError;

  return workouts.map((wo) => {
    const sets = (allSets || []).filter((s) => s.workout_id === wo.id);
    return {
      ...wo,
      started_at: wo.started_at,
      ended_at: wo.finished_at,
      sets: sets as unknown as WorkoutSetWithDetails[],
    } as unknown as WorkoutWithSets;
  });
};

export const fetchRecentSets = async (
  userId: string,
  limit = 1000,
): Promise<WorkoutSetWithDetails[]> => {
  try {
    const { data: workoutIds, error: woError } = await supabase
      .from('workouts')
      .select('id')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(300);

    if (woError) {
      console.error('Error fetching workout IDs:', woError);
      throw woError;
    }
    if (!workoutIds || workoutIds.length === 0) return [];

    const ids = workoutIds.map((w) => w.id);

    const { data, error: setsError } = await supabase
      .from('workout_sets')
      .select(
        'id, weight, reps, set_num, exercise_id, workout_id, created_at, notes, is_warmup, rpe, exercise:exercises(name), workout:workouts(started_at)',
      )
      .in('workout_id', ids)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (setsError) {
      console.error('Error fetching recent sets:', setsError);
      throw setsError;
    }

    return (data as unknown as WorkoutSetWithDetails[]) || [];
  } catch (err) {
    console.error('fetchRecentSets error:', err);
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
    console.warn('[fetchExercises] RPC failed, falling back:', error.message);
    const { data: rows, error: fbErr } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, user_id, created_at')
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
    .select('id, user_id, exercise_id, weight, reps, one_rm, workout_set_id, achieved_at')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching personal records:', error);
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

export const fetchVolumeByMuscleGroup = async (
  userId: string,
): Promise<{ muscle_group: string; total_volume: number }[]> => {
  const { data, error } = await supabase.rpc('get_volume_by_muscle_group', { user_uuid: userId });
  if (error) {
    console.error('[Volume] Error fetching volume:', error);
    throw error;
  }
  return data || [];
};
