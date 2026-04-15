import { z } from 'zod';

export const WorkoutExerciseSchema = z.object({
  id: z.string().uuid(),
  workout_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  user_id: z.string().uuid(),
  order_index: z.number().int().nonnegative(),
  notes: z.string().max(500).optional(),
  created_at: z.string().datetime({ offset: true }),
});

export type WorkoutExercise = z.infer<typeof WorkoutExerciseSchema>;
export type WorkoutExerciseInput = Omit<WorkoutExercise, 'id' | 'created_at'>;

export const WorkoutExerciseWithDetailsSchema = WorkoutExerciseSchema.extend({
  exercise: z.object({
    id: z.string().uuid(),
    name: z.string(),
    muscle_group: z.string(),
    user_id: z.string().uuid().nullable(),
  }),
});

export type WorkoutExerciseWithDetails = z.infer<typeof WorkoutExerciseWithDetailsSchema>;

export const CreateExerciseNoteSchema = z.object({
  exerciseId: z.string().uuid(),
  note: z.string().min(1, 'Nota requerida').max(500, 'Máximo 500 caracteres'),
});

export type CreateExerciseNoteInput = z.infer<typeof CreateExerciseNoteSchema>;

export const UpdateExerciseNoteSchema = z.object({
  noteId: z.string().uuid(),
  note: z.string().min(1, 'Nota requerida').max(500, 'Máximo 500 caracteres'),
});

export type UpdateExerciseNoteInput = z.infer<typeof UpdateExerciseNoteSchema>;

export const CreateCustomExerciseSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  muscle_group: z.string().min(1),
  equipment: z.string().optional(),
});

export type CreateCustomExerciseInput = z.infer<typeof CreateCustomExerciseSchema>;
