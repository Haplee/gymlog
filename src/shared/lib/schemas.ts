import { z } from 'zod';

// ─── Primitivos ───────────────────────────────

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });

// ─── Exercise ────────────────────────────────

export const EquipmentSchema = z.enum([
  'barbell',
  'dumbbell',
  'machine',
  'bodyweight',
  'cable',
  'other',
]);

export const ExerciseSchema = z.object({
  id: uuid,
  name: z.string().min(1, 'Nombre requerido').max(100),
  muscle_group: z.string().min(1),
  user_id: z.string().nullable(),
  created_at: isoDate,
  equipment: EquipmentSchema.optional(),
  is_compound: z.boolean().optional(),
});

export type ExerciseInput = z.infer<typeof ExerciseSchema>;

// ─── Workout ─────────────────────────────────

export const WorkoutSchema = z.object({
  id: uuid,
  user_id: uuid,
  started_at: isoDate,
  ended_at: isoDate.optional(),
  duration_seconds: z.number().int().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export type WorkoutInput = z.infer<typeof WorkoutSchema>;

// ─── WorkoutSet ──────────────────────────────

export const WorkoutSetSchema = z.object({
  id: uuid,
  workout_id: uuid,
  exercise_id: uuid,
  set_num: z.number().int().positive(),
  reps: z.number().int().positive('Reps debe ser > 0'),
  weight: z.number().nonnegative('Peso no puede ser negativo'),
  created_at: isoDate,
  notes: z.string().max(200).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  is_warmup: z.boolean().optional().default(false),
});

export type WorkoutSetInput = z.infer<typeof WorkoutSetSchema>;

// ─── SetFormData (validación formulario) ─────

export const SetFormDataSchema = z.object({
  reps: z
    .string()
    .min(1, 'Campo requerido')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Debe ser un número positivo'),
  weight: z
    .string()
    .min(1, 'Campo requerido')
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, 'Debe ser ≥ 0'),
  rpe: z.string().optional(),
  is_warmup: z.boolean().optional(),
  notes: z.string().max(200).optional(),
});

export type SetFormData = z.infer<typeof SetFormDataSchema>;

// ─── PersonalRecord ──────────────────────────

export const PersonalRecordSchema = z.object({
  id: uuid,
  user_id: uuid,
  exercise_id: uuid,
  weight: z.number().positive(),
  reps: z.number().int().positive(),
  created_at: isoDate,
});

export type PersonalRecordInput = z.infer<typeof PersonalRecordSchema>;

// ─── UserRoutine ─────────────────────────────

export const UserRoutineSchema = z.object({
  id: uuid,
  user_id: uuid,
  day_of_week: z.number().int().min(0).max(6),
  exercise_id: uuid,
  order_index: z.number().int().nonnegative(),
  created_at: isoDate,
});

export type UserRoutineInput = z.infer<typeof UserRoutineSchema>;

// ─── BodyMeasurement ─────────────────────────

export const BodyMeasurementSchema = z.object({
  id: uuid,
  user_id: uuid,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  weight_kg: z.number().positive().optional(),
  body_fat_pct: z.number().min(0).max(100).optional(),
  muscle_mass_kg: z.number().positive().optional(),
  notes: z.string().max(300).optional(),
});

export type BodyMeasurementInput = z.infer<typeof BodyMeasurementSchema>;

// ─── ExerciseNote ────────────────────────────

export const ExerciseNoteSchema = z.object({
  id: uuid,
  user_id: uuid,
  exercise_id: uuid,
  note: z.string().min(1).max(500),
  created_at: isoDate,
});

export type ExerciseNoteInput = z.infer<typeof ExerciseNoteSchema>;

// ─── Auth forms ──────────────────────────────

export const LoginFormSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export type LoginFormData = z.infer<typeof LoginFormSchema>;

export const RegisterFormSchema = LoginFormSchema.extend({
  fullName: z.string().min(2, 'Nombre demasiado corto').max(60),
  username: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(30)
    .regex(/^[a-z0-9_]+$/, 'Solo minúsculas, números y _'),
});

export type RegisterFormData = z.infer<typeof RegisterFormSchema>;
