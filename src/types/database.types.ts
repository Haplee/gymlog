export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          username: string | null;
          avatar_url: string | null;
          bio: string | null;
          weight_unit: string;
          updated_at: string | null;
          goal: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          weight_unit?: string;
          updated_at?: string | null;
          goal?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          weight_unit?: string;
          updated_at?: string | null;
          goal?: string | null;
        };
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          muscle_group: string;
          muscle_detail: string | null;
          equipment: string;
          movement: string | null;
          is_bilateral: boolean;
          user_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          muscle_group: string;
          muscle_detail?: string | null;
          equipment?: string;
          movement?: string | null;
          is_bilateral?: boolean;
          user_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          muscle_group?: string;
          muscle_detail?: string | null;
          equipment?: string;
          movement?: string | null;
          is_bilateral?: boolean;
          user_id?: string | null;
          created_at?: string | null;
        };
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          notes: string | null;
          status: string;
          started_at: string | null;
          finished_at: string | null;
          total_volume: number;
          total_sets: number;
          duration_min: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          notes?: string | null;
          status?: string;
          started_at?: string | null;
          finished_at?: string | null;
          total_volume?: number;
          total_sets?: number;
          duration_min?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string | null;
          notes?: string | null;
          status?: string;
          started_at?: string | null;
          finished_at?: string | null;
          total_volume?: number;
          total_sets?: number;
          duration_min?: number | null;
        };
      };
      workout_sets: {
        Row: {
          id: string;
          workout_id: string;
          exercise_id: string;
          set_num: number;
          reps: number;
          weight: number;
          created_at: string | null;
          notes: string | null;
          rpe: number | null;
          is_warmup: boolean | null;
        };
        Insert: {
          id?: string;
          workout_id: string;
          exercise_id: string;
          set_num: number;
          reps: number;
          weight: number;
          created_at?: string | null;
          notes?: string | null;
          rpe?: number | null;
          is_warmup?: boolean | null;
        };
        Update: {
          id?: string;
          workout_id?: string;
          exercise_id?: string;
          set_num?: number;
          reps?: number;
          weight?: number;
          created_at?: string | null;
          notes?: string | null;
          rpe?: number | null;
          is_warmup?: boolean | null;
        };
      };
      workout_exercises: {
        Row: {
          id: string;
          workout_id: string;
          exercise_id: string;
          user_id: string;
          order_index: number;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          workout_id: string;
          exercise_id: string;
          user_id: string;
          order_index?: number;
          notes?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          workout_id?: string;
          exercise_id?: string;
          user_id?: string;
          order_index?: number;
          notes?: string | null;
          created_at?: string | null;
        };
      };
      personal_records: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          weight: number;
          reps: number;
          one_rm: number | null;
          workout_set_id: string | null;
          achieved_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_id: string;
          weight: number;
          reps: number;
          one_rm?: number | null;
          workout_set_id?: string | null;
          achieved_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise_id?: string;
          weight?: number;
          reps?: number;
          one_rm?: number | null;
          workout_set_id?: string | null;
          achieved_at?: string | null;
        };
      };
      exercise_notes: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          note: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_id: string;
          note: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise_id?: string;
          note?: string;
          created_at?: string | null;
        };
      };
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Exercise = Database['public']['Tables']['exercises']['Row'];
export type Workout = Database['public']['Tables']['workouts']['Row'];
export type WorkoutSet = Database['public']['Tables']['workout_sets']['Row'];
export type WorkoutExercise = Database['public']['Tables']['workout_exercises']['Row'];
export type PersonalRecord = Database['public']['Tables']['personal_records']['Row'];
export type ExerciseNote = Database['public']['Tables']['exercise_notes']['Row'];

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
