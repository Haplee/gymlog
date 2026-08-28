/**
 * Clave i18n de un valor del catálogo escrito en español.
 *
 * Los valores de `exercises.muscle_group` y `exercises.equipment` se guardan en
 * español y con tildes («Glúteo», «Máquina», «Peso corporal»). La clave es ese
 * mismo valor en minúsculas, sin acentos y con guiones bajos, para que
 * `muscleGroups.gluteo` y `equipment.peso_corporal` se puedan escribir a mano en
 * el fichero de traducciones sin pelearse con el teclado.
 */
export function catalogKey(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_');
}
