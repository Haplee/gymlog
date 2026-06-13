import { supabase } from '@shared/lib/supabase';
import type { CreateCustomExerciseInput } from '../types';
import { CreateCustomExerciseSchema } from '../types';

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
