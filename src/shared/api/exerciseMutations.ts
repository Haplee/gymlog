import { z } from 'zod';
import { supabase } from '@shared/lib/supabase';

export const CreateCustomExerciseSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  muscle_group: z.string().min(1),
  equipment: z.string().optional(),
});

export type CreateCustomExerciseInput = z.infer<typeof CreateCustomExerciseSchema>;

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
