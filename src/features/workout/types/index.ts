import { z } from 'zod';

export const CreateCustomExerciseSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  muscle_group: z.string().min(1),
  equipment: z.string().optional(),
});

export type CreateCustomExerciseInput = z.infer<typeof CreateCustomExerciseSchema>;
