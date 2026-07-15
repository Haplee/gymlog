import type { RawExercise } from '@features/workout/api/exercisedb';

/** Origen de un ejercicio en la UI unificada de exploración. */
export type ExerciseSource = 'own' | 'public' | 'exercisedb';

/**
 * Modelo de dominio estable al que se proyectan tanto los ejercicios de
 * Supabase (propios/públicos) como los del catálogo ExerciseDB. La UI depende
 * solo de este tipo, nunca del shape crudo de la API.
 */
export interface CatalogExercise {
  id: string;
  source: ExerciseSource;
  name: string;
  mediaUrl: string | null;
  videoUrl: string | null;
  bodyParts: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  instructions: string[];
}

/** Quita el prefijo "Step:N " que añade ExerciseDB a cada instrucción. */
function cleanInstruction(step: string): string {
  return step.replace(/^Step:\s*\d+\s*/i, '').trim();
}

/** Normaliza un ejercicio crudo de ExerciseDB al modelo de dominio. */
export function mapExerciseDbExercise(raw: RawExercise): CatalogExercise {
  return {
    id: raw.exerciseId,
    source: 'exercisedb',
    name: raw.name ?? '',
    mediaUrl: raw.gifUrl ?? raw.imageUrl ?? null,
    videoUrl: raw.videoUrl ?? null,
    // Vocabulario en inglés crudo; se localiza al mostrar según el idioma.
    bodyParts: raw.bodyParts ?? [],
    targetMuscles: raw.targetMuscles ?? [],
    secondaryMuscles: raw.secondaryMuscles ?? [],
    equipment: raw.equipments ?? [],
    instructions: (raw.instructions ?? []).map(cleanInstruction).filter(Boolean),
  };
}

export function mapExerciseDbList(list: RawExercise[]): CatalogExercise[] {
  return list.map(mapExerciseDbExercise);
}
