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

/** Fila de músculo ponderado leída de la BD. */
export interface ExerciseMuscle {
  muscle_group: string;
  role: 'primary' | 'secondary';
  weight: number;
}

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

/** Lee los músculos ponderados de un ejercicio (primario primero). */
export async function fetchExerciseMuscles(exerciseId: string): Promise<ExerciseMuscle[]> {
  const { data, error } = await supabase
    .from('exercise_muscles')
    .select('muscle_group, role, weight')
    .eq('exercise_id', exerciseId);
  if (error) throw error;
  const rows = (data ?? []) as ExerciseMuscle[];
  return rows.toSorted((a, b) => (a.role === 'primary' ? -1 : b.role === 'primary' ? 1 : 0));
}

/**
 * Mapa masivo `exercise_id → músculos ponderados` para todos los ejercicios
 * visibles (propios + públicos; RLS lo garantiza). Una sola consulta, sin N+1.
 */
export async function fetchExerciseMusclesMap(
  _userId: string,
): Promise<Record<string, ExerciseMuscle[]>> {
  const { data, error } = await supabase
    .from('exercise_muscles')
    .select('exercise_id, muscle_group, role, weight');
  if (error) throw error;
  const map: Record<string, ExerciseMuscle[]> = {};
  for (const row of (data ?? []) as (ExerciseMuscle & { exercise_id: string })[]) {
    (map[row.exercise_id] ??= []).push({
      muscle_group: row.muscle_group,
      role: row.role,
      weight: row.weight,
    });
  }
  return map;
}
