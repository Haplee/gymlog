export interface Profile {
  id: string;
  email: string;
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  user_id: string;
  created_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_num: number;
  reps: number;
  weight: number;
  created_at: string;
  notes?: string;
  exercise?: { name: string } | Exercise;
  workout?: { started_at: string } | Workout;
}

export interface WorkoutSetWithDetails extends Omit<WorkoutSet, 'exercise' | 'workout'> {
  exercise: { name: string };
  workout: { started_at: string };
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_id: string;
  weight: number;
  reps: number;
  created_at: string;
}

export interface WorkoutWithSets {
  id: string;
  started_at: string;
  ended_at?: string;
  sets: WorkoutSetWithDetails[];
}
