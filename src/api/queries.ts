import { supabase } from '../lib/supabase';
import type { WorkoutWithSets, WorkoutSetWithDetails, PersonalRecord, Exercise } from '../lib/types';

export const fetchWorkoutsAndSets = async (userId: string) => {
  const { data: workoutIds, error } = await supabase
    .from('workouts')
    .select('id, started_at, ended_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  if (!workoutIds || workoutIds.length === 0) return { workouts: [], sets: [] };

  const ids = workoutIds.map(w => w.id);

  const { data: allSets, error: setsError } = await supabase
    .from('workout_sets')
    .select('*, exercise:exercises(name), workout:workouts(started_at)')
    .in('workout_id', ids)
    .order('created_at', { ascending: false });

  if (setsError) throw setsError;

  const workouts: WorkoutWithSets[] = workoutIds.map(wo => {
    const sets = (allSets || []).filter(s => s.workout_id === wo.id);
    return {
      id: wo.id,
      started_at: wo.started_at,
      ended_at: wo.ended_at,
      sets: sets as WorkoutSetWithDetails[]
    };
  });

  return { workouts, sets: (allSets as WorkoutSetWithDetails[]) || [] };
};

export const fetchWorkouts = async (userId: string): Promise<WorkoutWithSets[]> => {
  const { data: workoutIds, error } = await supabase
    .from('workouts')
    .select('id, started_at, ended_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  if (!workoutIds || workoutIds.length === 0) return [];

  const ids = workoutIds.map(w => w.id);

  const { data: allSets, error: setsError } = await supabase
    .from('workout_sets')
    .select('*, exercise:exercises(name)')
    .in('workout_id', ids);

  if (setsError) throw setsError;

  return workoutIds.map(wo => {
    const sets = (allSets || []).filter(s => s.workout_id === wo.id);
    return {
      id: wo.id,
      started_at: wo.started_at,
      ended_at: wo.ended_at,
      sets: sets as WorkoutSetWithDetails[]
    };
  });
};

export const fetchRecentSets = async (userId: string): Promise<WorkoutSetWithDetails[]> => {
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
    .select('*, exercise:exercises(name), workout:workouts(started_at)')
    .in('workout_id', ids)
    .order('created_at', { ascending: false })
    .limit(50);

  if (setsError) throw setsError;

  return (data as WorkoutSetWithDetails[]) || [];
};

export const fetchExercises = async (userId: string | undefined): Promise<Exercise[]> => {
  if (userId) {
    const { data: userExercises, error: userExError } = await supabase
      .from('exercises')
      .select('id')
      .eq('user_id', userId);
    
    if (userExError) throw userExError;

    const userExerciseIds = userExercises?.map(e => e.id) || [];
    const usage: Record<string, number> = {};

    if (userExerciseIds.length > 0) {
      const { data: usageData, error: usageError } = await supabase
        .from('workout_sets')
        .select('exercise_id')
        .in('exercise_id', userExerciseIds);

      if (!usageError && usageData) {
        usageData.forEach(s => {
          usage[s.exercise_id] = (usage[s.exercise_id] || 0) + 1;
        });
      }
    }

    const { data: userExData, error: userDataError } = await supabase
      .from('exercises')
      .select('*')
      .eq('user_id', userId);
    
    if (userDataError) throw userDataError;
    
    const { data: globalExData, error: globalError } = await supabase
      .from('exercises')
      .select('*')
      .is('user_id', null)
      .order('name');
    
    if (globalError) throw globalError;

    const allEx = [...(userExData || []), ...(globalExData || [])];
    return allEx.sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0));
  } else {
    const { data, error } = await supabase.from('exercises').select('*').order('name');
    if (error) throw error;
    return data || [];
  }
};

export const fetchPersonalRecords = async (userId: string): Promise<PersonalRecord[]> => {
  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data || [];
};
