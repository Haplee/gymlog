import { supabase } from '@shared/lib/supabase';
import type {
  WorkoutWithSets,
  WorkoutSetWithDetails,
  PersonalRecord,
  Exercise,
  ExerciseNote,
} from '@shared/lib/types';

export const fetchWorkoutsAndSets = async (userId: string, limit = 200) => {
  try {
    const { data: workoutIds, error } = await supabase
      .from('workouts')
      .select('id, started_at, finished_at')
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
      .select('*, exercise:exercises(name, muscle_group), workout:workouts(started_at)')
      .in('workout_id', ids)
      .order('created_at', { ascending: false });

    if (setsError) {
      console.error('Error fetching sets:', setsError);
      throw setsError;
    }

    const workouts: WorkoutWithSets[] = workoutIds.map((wo) => {
      const sets = (allSets || []).filter((s) => s.workout_id === wo.id);
      return {
        id: wo.id,
        started_at: wo.started_at,
        ended_at: wo.finished_at,
        sets: sets as unknown as WorkoutSetWithDetails[],
      };
    });

    return { workouts, sets: (allSets as WorkoutSetWithDetails[]) || [] };
  } catch (err) {
    console.error('fetchWorkoutsAndSets error:', err);
    throw err;
  }
};

export const fetchWorkouts = async (userId: string, limit = 20): Promise<WorkoutWithSets[]> => {
  const { data: workoutIds, error } = await supabase
    .from('workouts')
    .select('id, started_at, ended_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!workoutIds || workoutIds.length === 0) return [];

  const ids = workoutIds.map((w) => w.id);

  const { data: allSets, error: setsError } = await supabase
    .from('workout_sets')
    .select(
      'id, weight, reps, set_num, exercise_id, workout_id, created_at, exercise:exercises(name)',
    )
    .in('workout_id', ids);

  if (setsError) throw setsError;

  return workoutIds.map((wo) => {
    const sets = (allSets || []).filter((s) => s.workout_id === wo.id);
    return {
      id: wo.id,
      started_at: wo.started_at,
      ended_at: wo.ended_at,
      sets: sets as unknown as WorkoutSetWithDetails[],
    };
  });
};

export const fetchRecentSets = async (
  userId: string,
  limit = 50,
): Promise<WorkoutSetWithDetails[]> => {
  const { data: workoutIds, error: woError } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(10);

  if (woError) throw woError;
  if (!workoutIds || workoutIds.length === 0) return [];

  const ids = workoutIds.map((w) => w.id);

  const { data, error: setsError } = await supabase
    .from('workout_sets')
    .select(
      'id, weight, reps, set_num, exercise_id, workout_id, created_at, exercise:exercises(name), workout:workouts(started_at)',
    )
    .in('workout_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (setsError) throw setsError;

  return (data as unknown as WorkoutSetWithDetails[]) || [];
};

export const fetchExercises = async (userId: string | undefined): Promise<Exercise[]> => {
  if (userId) {
    const { data: userExercises, error: userExError } = await supabase
      .from('exercises')
      .select('id')
      .eq('user_id', userId);

    if (userExError) throw userExError;

    const userExerciseIds = userExercises?.map((e) => e.id) || [];
    const usage: Record<string, number> = {};

    if (userExerciseIds.length > 0) {
      const { data: usageData, error: usageError } = await supabase
        .from('workout_sets')
        .select('exercise_id')
        .in('exercise_id', userExerciseIds);

      if (!usageError && usageData) {
        usageData.forEach((s) => {
          usage[s.exercise_id] = (usage[s.exercise_id] || 0) + 1;
        });
      }
    }

    const { data: userExData, error: userDataError } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, user_id, created_at')
      .eq('user_id', userId);

    if (userDataError) throw userDataError;

    const { data: globalExData, error: globalError } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, user_id, created_at')
      .is('user_id', null)
      .order('name');

    if (globalError) throw globalError;

    const allEx = [...(userExData || []), ...(globalExData || [])];
    return allEx.sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0));
  } else {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, user_id, created_at')
      .order('name');
    if (error) throw error;
    return data || [];
  }
};

export const fetchPersonalRecords = async (userId: string): Promise<PersonalRecord[]> => {
  const { data, error } = await supabase
    .from('personal_records')
    .select('id, user_id, exercise_id, weight, reps, created_at, estimated_1rm, achieved_at')
    .eq('user_id', userId);

  if (error) throw error;
  return (data as unknown as PersonalRecord[]) || [];
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
  return (data as unknown as ExerciseNote[]) || [];
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
  return data as unknown as ExerciseNote;
};

export const deleteExerciseNote = async (noteId: string): Promise<void> => {
  const { error } = await supabase.from('exercise_notes').delete().eq('id', noteId);
  if (error) throw error;
};

export const deleteExercise = async (exerciseId: string): Promise<void> => {
  const { error } = await supabase.from('exercises').delete().eq('id', exerciseId);
  if (error) throw error;
};
