import { z } from 'zod';
import { supabase } from '@shared/lib/supabase';
import type { LoadType } from '@shared/lib/loadType';
import { LOAD_TYPES } from '@shared/lib/loadType';

/** Un grupo muscular con su peso de contribución (0–100). */
export const MuscleWeightSchema = z.object({
  muscle_group: z.string().min(1),
  weight: z.number().min(0).max(100),
});
export type MuscleWeight = z.infer<typeof MuscleWeightSchema>;

export const CreateCustomExerciseSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  /** Grupo muscular primario (se conserva denormalizado en exercises.muscle_group). */
  muscle_group: z.string().min(1),
  /** Peso del primario (por defecto 100). */
  primary_weight: z.number().min(0).max(100).default(100),
  /** Grupos musculares secundarios ponderados. */
  secondaries: z.array(MuscleWeightSchema).default([]),
  equipment: z.string().optional(),
  is_compound: z.boolean().optional(),
  is_bodyweight: z.boolean().optional(),
  /** Modalidad de carga; si se omite se deriva de is_bodyweight. */
  load_type: z.enum(LOAD_TYPES as unknown as [LoadType, ...LoadType[]]).optional(),
});

/** Resuelve la modalidad efectiva a partir de load_type o del flag legacy. */
function resolveLoadType(input: { load_type?: LoadType; is_bodyweight?: boolean }): LoadType {
  if (input.load_type) return input.load_type;
  return input.is_bodyweight ? 'bodyweight' : 'external';
}

export type CreateCustomExerciseInput = z.input<typeof CreateCustomExerciseSchema>;

/** Reemplaza los músculos ponderados de un ejercicio (primario + secundarios). */
async function syncExerciseMuscles(
  exerciseId: string,
  primary: string,
  primaryWeight: number,
  secondaries: MuscleWeight[],
): Promise<void> {
  await supabase.from('exercise_muscles').delete().eq('exercise_id', exerciseId);
  const rows = [
    { exercise_id: exerciseId, muscle_group: primary, role: 'primary', weight: primaryWeight },
    // Evitar duplicar el primario (unique (exercise_id, muscle_group)).
    ...secondaries
      .filter((s) => s.muscle_group !== primary)
      .map((s) => ({
        exercise_id: exerciseId,
        muscle_group: s.muscle_group,
        role: 'secondary' as const,
        weight: s.weight,
      })),
  ];
  const { error } = await supabase.from('exercise_muscles').insert(rows);
  if (error) throw error;
}

export async function createCustomExercise(
  userId: string,
  input: CreateCustomExerciseInput,
): Promise<{ id: string; name: string }> {
  const parsed = CreateCustomExerciseSchema.parse(input);
  const loadType = resolveLoadType(parsed);
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: parsed.name,
      muscle_group: parsed.muscle_group,
      equipment: parsed.equipment,
      is_compound: parsed.is_compound ?? false,
      is_bodyweight: loadType !== 'external',
      load_type: loadType,
      user_id: userId,
    })
    .select('id, name')
    .single();

  if (error) throw error;

  await syncExerciseMuscles(
    data.id,
    parsed.muscle_group,
    parsed.primary_weight,
    parsed.secondaries,
  );
  return { id: data.id, name: data.name };
}

export async function updateCustomExercise(
  exerciseId: string,
  input: CreateCustomExerciseInput,
): Promise<void> {
  const parsed = CreateCustomExerciseSchema.parse(input);
  const loadType = resolveLoadType(parsed);
  const { error } = await supabase
    .from('exercises')
    .update({
      name: parsed.name,
      muscle_group: parsed.muscle_group,
      equipment: parsed.equipment,
      is_compound: parsed.is_compound ?? false,
      is_bodyweight: loadType !== 'external',
      load_type: loadType,
    })
    .eq('id', exerciseId);
  if (error) throw error;

  await syncExerciseMuscles(
    exerciseId,
    parsed.muscle_group,
    parsed.primary_weight,
    parsed.secondaries,
  );
}

/**
 * Cambia solo la modalidad de carga de un ejercicio (mini-selector en el
 * registro de series). Mantiene is_bodyweight coherente para compatibilidad.
 */
export async function updateExerciseLoadType(
  exerciseId: string,
  loadType: LoadType,
): Promise<void> {
  const { error } = await supabase
    .from('exercises')
    .update({ load_type: loadType, is_bodyweight: loadType !== 'external' })
    .eq('id', exerciseId);
  if (error) throw error;
}
