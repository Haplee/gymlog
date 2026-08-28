/**
 * Valores de `exercises.equipment` que la app conoce, en el español en que se
 * guardan.
 *
 * Es la lista canónica: de aquí salen los iconos (`EquipmentIcons`) y contra
 * ella se comprueba que no falte ninguna traducción. Los ejercicios del catálogo
 * público de ExerciseDB traen los suyos en inglés («assisted», «smith machine»)
 * y no pertenecen a este enum: se muestran como vengan.
 */
export const EQUIPMENT_TYPES = [
  'Barra',
  'Mancuernas',
  'Máquina',
  'Polea',
  'Peso corporal',
  'Bandas',
  'Kettlebell',
  'Otro',
] as const;

export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];
