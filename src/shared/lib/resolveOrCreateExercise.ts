import { supabase } from './supabase';

/** Escapa los comodines de LIKE/ILIKE para buscar el nombre literal. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/**
 * Busca un ejercicio por nombre (case-insensitive) considerando tanto los
 * ejercicios del usuario como los públicos (user_id IS NULL).
 * Devuelve el del usuario si existe; si no, el público; si no, null.
 */
async function findExerciseByName(userId: string, name: string): Promise<string | null> {
  const pattern = escapeLikePattern(name.trim());

  // 1) Primero busca ejercicio del usuario
  const { data: userEx, error: userErr } = await supabase
    .from('exercises')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', pattern)
    .maybeSingle();
  if (userErr) throw userErr;
  if (userEx?.id) return userEx.id;

  // 2) Si no hay del usuario, busca ejercicio público (catálogo global)
  const { data: publicEx, error: publicErr } = await supabase
    .from('exercises')
    .select('id')
    .is('user_id', null)
    .ilike('name', pattern)
    .maybeSingle();
  if (publicErr) throw publicErr;
  if (publicEx?.id) return publicEx.id;

  return null;
}

/**
 * Resuelve el id de un ejercicio custom por (usuario, nombre) o lo crea si no
 * existe. Idempotente y seguro frente a restricciones únicas globales en `name`
 * (p.ej. `exercises_name_unique_idx`):
 * - Primero busca coincidencia en ejercicios del usuario o públicos.
 * - Si no existe, intenta insertar el ejercicio del usuario.
 * - Si el INSERT falla por clave duplicada (23505), vuelve a buscar y reutiliza
 *   el ejercicio existente (del usuario o público) en lugar de lanzar error.
 */
export async function resolveOrCreateExercise(
  userId: string,
  name: string,
  muscleGroup: string,
): Promise<string> {
  const trimmed = name.trim();

  // 1) Buscar ejercicio existente (usuario o público)
  const existingId = await findExerciseByName(userId, trimmed);
  if (existingId) return existingId;

  // 2) No existe → insertar ejercicio del usuario
  const { data, error } = await supabase
    .from('exercises')
    .insert({ name: trimmed, user_id: userId, muscle_group: muscleGroup })
    .select('id')
    .single();

  if (!error && data?.id) return data.id;

  // 3) Conflicto de clave duplicada (p.ej. índice único global en `name` o
  //    carrera con otro proceso). Re-buscar y reutilizar el existente.
  if (error?.code === '23505') {
    const racedId = await findExerciseByName(userId, trimmed);
    if (racedId) return racedId;
  }

  throw error ?? new Error('No se pudo crear el ejercicio');
}
