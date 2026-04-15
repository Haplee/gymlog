import type { Database } from '@/types/database.types';

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Profile = Tables<'profiles'>;
export type Exercise = Tables<'exercises'>;
export type Workout = Tables<'workouts'>;
export type WorkoutSet = Tables<'workout_sets'>;
export type PersonalRecord = Tables<'personal_records'>;
export type ExerciseNote = Tables<'exercise_notes'>;
export type UserRoutine = Tables<'user_routines'>;
export type BodyMeasurement = Tables<'body_measurements'>;

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'cable' | 'other';

export interface WorkoutSetWithDetails extends Omit<WorkoutSet, 'exercise' | 'workout'> {
  exercise: { name: string; muscle_group?: string };
  workout: { started_at: string | null };
}

export interface WorkoutWithSets extends Omit<
  Workout,
  'started_at' | 'finished_at' | 'total_volume' | 'total_sets' | 'duration_min'
> {
  started_at: string | null;
  ended_at: string | null;
  sets: WorkoutSetWithDetails[];
}

/** Tipo helper para datos de sets en el formulario */
export interface SetFormData {
  reps: string;
  weight: string;
  rpe?: string;
  is_warmup?: boolean;
  notes?: string;
}
