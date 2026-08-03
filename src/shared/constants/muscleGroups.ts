/**
 * Grupo muscular por defecto cuando un ejercicio no se puede clasificar
 * (imports, creación rápida, y todos los fallbacks de analítica).
 *
 * Debe existir como opción válida en la lista de grupos (`MUSCLE_GROUPS`) y
 * coincidir con el default del trigger de servidor `autoclassify_muscle_group`.
 * Si cambia aquí, cámbialo también allí.
 */
export const DEFAULT_MUSCLE_GROUP = 'Otro';

export const MUSCLE_GROUPS = [
  'Pecho',
  'Espalda',
  'Hombro',
  'Pierna',
  'Glúteo',
  'Bíceps',
  'Tríceps',
  'Antebrazo',
  'Core',
  'Cardio',
  DEFAULT_MUSCLE_GROUP,
];

export function suggestMuscleGroup(name: string): string | null {
  const n = name.toLowerCase();
  if (!n.trim()) return null;
  if (/antebrazo/.test(n)) return 'Antebrazo';
  if (/bíceps|biceps|curl|martillo/.test(n)) return 'Bíceps';
  if (/tríceps|triceps|press francés|fondos/.test(n)) return 'Tríceps';
  if (/pecho|press banca|aperturas|fly/.test(n)) return 'Pecho';
  if (/espalda|dominada|remo|jalón|jalon|pull/.test(n)) return 'Espalda';
  if (/hombro|militar|lateral|pájaro|pajaro/.test(n)) return 'Hombro';
  if (/glúteo|gluteo|hip thrust|puente/.test(n)) return 'Glúteo';
  if (
    /pierna|cuádriceps|cuadriceps|sentadilla|squat|peso muerto|femoral|isquio|gemelo|pantorrilla|lunge|zancada/.test(
      n,
    )
  )
    return 'Pierna';
  if (/abdomen|core|plancha|crunch|abdominal/.test(n)) return 'Core';
  if (/correr|bici|cardio|elíptica|eliptica/.test(n)) return 'Cardio';
  return null;
}
