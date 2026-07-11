import { supabase } from './supabase';

/** Escapa los comodines de LIKE/ILIKE para buscar el nombre literal. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/**
 * Resuelve el id de un ejercicio custom por (usuario, nombre) o lo crea si no
 * existe. Idempotente: si un INSERT previo tuvo éxito en el servidor pero la
 * respuesta se perdió (corte de red) y se reintenta, la búsqueda previa —o la
 * unique violation 23505 en caso de carrera— devuelve el ejercicio ya creado
 * en vez de duplicarlo. La comparación es case-insensitive, respaldada por el
 * índice único `exercises_user_lower_name_uniq` (user_id, lower(name)).
 */
export async function resolveOrCreateExercise(
  userId: string,
  name: string,
  muscleGroup: string,
): Promise<string> {
  const trimmed = name.trim();
  const pattern = escapeLikePattern(trimmed);

  const { data: existing, error: findError } = await supabase
    .from('exercises')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', pattern)
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('exercises')
    .insert({ name: trimmed, user_id: userId, muscle_group: muscleGroup })
    .select('id')
    .single();
  if (!error && data?.id) return data.id;

  // Carrera perdida: otro proceso (u otro flush concurrente) lo creó entre el
  // select y el insert. Re-seleccionar y devolver el existente.
  if (error?.code === '23505') {
    const { data: raced, error: retryError } = await supabase
      .from('exercises')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', pattern)
      .maybeSingle();
    if (retryError) throw retryError;
    if (raced?.id) return raced.id;
  }

  throw error ?? new Error('No se pudo crear el ejercicio');
}
