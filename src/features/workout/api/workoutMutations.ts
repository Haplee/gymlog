import { supabase } from '@shared/lib/supabase';
import type { QueryClient } from '@tanstack/react-query';
import type {
  WorkoutExercise,
  WorkoutExerciseInput,
  CreateExerciseNoteInput,
  CreateCustomExerciseInput,
} from '../types';
import { CreateExerciseNoteSchema, CreateCustomExerciseSchema } from '../types';

const WORKOUT_EXERCISES_QUERY_KEY = ['workoutExercises'];

export const WORKOUT_EXERCISES_KEYS = {
  all: () => WORKOUT_EXERCISES_QUERY_KEY,
  byWorkout: (workoutId: string) => [...WORKOUT_EXERCISES_QUERY_KEY, workoutId],
  detail: (workoutId: string, exerciseId: string) => [
    ...WORKOUT_EXERCISES_QUERY_KEY,
    workoutId,
    exerciseId,
  ],
};

export async function fetchWorkoutExercises(workoutId: string): Promise<WorkoutExercise[]> {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('*')
    .eq('workout_id', workoutId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
  userId: string,
): Promise<WorkoutExercise> {
  const { data: existing } = await supabase
    .from('workout_exercises')
    .select('id')
    .eq('workout_id', workoutId)
    .eq('exercise_id', exerciseId)
    .single();

  if (existing) throw new Error('El ejercicio ya está en este workout');

  const { data: maxOrder } = await supabase
    .from('workout_exercises')
    .select('order_index')
    .eq('workout_id', workoutId)
    .order('order_index', { ascending: false })
    .limit(1)
    .single();

  const orderIndex = (maxOrder?.order_index ?? -1) + 1;

  const { data, error } = await supabase
    .from('workout_exercises')
    .insert({
      workout_id: workoutId,
      exercise_id: exerciseId,
      user_id: userId,
      order_index: orderIndex,
    } as WorkoutExerciseInput)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Error adding exercise to workout');
  return data;
}

export async function removeExerciseFromWorkout(workoutExerciseId: string): Promise<void> {
  const { error } = await supabase.from('workout_exercises').delete().eq('id', workoutExerciseId);

  if (error) throw error;
}

export async function updateExerciseNotes(
  workoutExerciseId: string,
  notes: string,
): Promise<WorkoutExercise> {
  const { data, error } = await supabase
    .from('workout_exercises')
    .update({ notes })
    .eq('id', workoutExerciseId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createCustomExercise(
  userId: string,
  input: CreateCustomExerciseInput,
): Promise<{ id: string; name: string }> {
  const parsed = CreateCustomExerciseSchema.parse(input);
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: parsed.name,
      muscle_group: parsed.muscle_group,
      equipment: parsed.equipment,
      user_id: userId,
    })
    .select('id, name')
    .single();

  if (error) throw error;
  return { id: data.id, name: data.name };
}

export async function createExerciseNote(
  userId: string,
  input: CreateExerciseNoteInput,
): Promise<{ id: string }> {
  const parsed = CreateExerciseNoteSchema.parse(input);
  const { data, error } = await supabase
    .from('exercise_notes')
    .insert({
      user_id: userId,
      exercise_id: parsed.exerciseId,
      note: parsed.note,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { id: data.id };
}

export async function deleteExerciseNote(noteId: string): Promise<void> {
  const { error } = await supabase.from('exercise_notes').delete().eq('id', noteId);

  if (error) throw error;
}

export async function searchExercises(
  query: string,
  userId: string | undefined,
): Promise<{ id: string; name: string; muscle_group: string; user_id: string | null }[]> {
  if (!query.trim()) {
    return fetchExercisesSearch(userId);
  }

  const searchTerm = `%${query}%`;
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, muscle_group, user_id')
    .or(`user_id.eq.${userId ?? 'null'},user_id.is.null`)
    .ilike('name', searchTerm)
    .order('name')
    .limit(20);

  if (error) throw error;
  return data || [];
}

export async function fetchExercisesSearch(
  userId: string | undefined,
): Promise<{ id: string; name: string; muscle_group: string; user_id: string | null }[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, muscle_group, user_id')
    .or(`user_id.eq.${userId ?? 'null'},user_id.is.null`)
    .order('name')
    .limit(20);

  if (error) throw error;
  return data || [];
}

export function getOptimisticRemoveExercise(
  queryClient: QueryClient,
  workoutId: string,
  workoutExerciseId: string,
): void {
  queryClient.setQueryData<WorkoutExercise[]>(
    WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
    (old) => old?.filter((we) => we.id !== workoutExerciseId) || [],
  );
}

export function getOptimisticAddExercise(
  queryClient: QueryClient,
  workoutId: string,
  newExercise: WorkoutExercise,
): void {
  queryClient.setQueryData<WorkoutExercise[]>(
    WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
    (old) => [...(old || []), newExercise],
  );
}

export function getOptimisticUpdateNotes(
  queryClient: QueryClient,
  workoutId: string,
  workoutExerciseId: string,
  notes: string,
): void {
  queryClient.setQueryData<WorkoutExercise[]>(
    WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
    (old) => old?.map((we) => (we.id === workoutExerciseId ? { ...we, notes } : we)) || [],
  );
}
