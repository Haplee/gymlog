// ─────────────────────────────────────────────
// GymLog v2.0 — Tipos globales TypeScript
// ─────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  created_at: string;
  full_name?: string;
  username?: string;
  avatar_url?: string;
  /** Objetivo de entrenamiento (onboarding) */
  goal?: 'volume' | 'strength' | 'endurance' | 'fat_loss';
  /** Días disponibles por semana (onboarding) */
  days_per_week?: number;
  /** Equipamiento disponible (onboarding) */
  equipment_available?: string[];
}

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'cable' | 'other';

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  user_id: string | null;
  created_at: string;
  /** Tipo de equipamiento (v2) */
  equipment?: Equipment;
  /** ¿Es ejercicio compuesto? (v2) */
  is_compound?: boolean;
}

export interface Workout {
  id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  /** Duración en segundos (v2) */
  duration_seconds?: number;
  /** Notas del entrenamiento (v2) */
  notes?: string;
  /** Valoración 1-5 (v2) */
  rating?: number;
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
  /** RPE 1-10 (v2) */
  rpe?: number;
  /** ¿Es serie de calentamiento? (v2) */
  is_warmup?: boolean;
  exercise?: { name: string } | Exercise;
  workout?: { started_at: string } | Workout;
}

export interface WorkoutSetWithDetails extends Omit<WorkoutSet, 'exercise' | 'workout'> {
  exercise: { name: string; muscle_group?: string };
  workout: { started_at: string };
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_id: string;
  weight: number;
  reps: number;
  created_at: string;
  exercise?: { name: string };
}

export interface WorkoutWithSets {
  id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  notes?: string;
  rating?: number;
  sets: WorkoutSetWithDetails[];
}

export interface UserRoutine {
  id: string;
  user_id: string;
  day_of_week: number; // 0=Lunes…6=Domingo
  exercise_id: string;
  order_index: number;
  created_at: string;
  exercise?: Exercise;
}

/** v2 — Medidas corporales */
export interface BodyMeasurement {
  id: string;
  user_id: string;
  date: string;
  weight_kg?: number;
  body_fat_pct?: number;
  muscle_mass_kg?: number;
  notes?: string;
}

/** v2 — Notas por ejercicio */
export interface ExerciseNote {
  id: string;
  user_id: string;
  exercise_id: string;
  note: string;
  created_at: string;
}

/** Tipo helper para datos de sets en el formulario */
export interface SetFormData {
  reps: string;
  weight: string;
  rpe?: string;
  is_warmup?: boolean;
  notes?: string;
}
