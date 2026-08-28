/**
 * Nombre del equipamiento de un ejercicio para MOSTRAR.
 *
 * Hermano de `muscleGroupLabel` y por el mismo motivo: `exercises.equipment`
 * guarda el literal español («Mancuernas»), se filtra por él, y traducirlo
 * dejaría los chips de la biblioteca sin encontrar sus ejercicios.
 *
 * **No confundir con `translateEquipment` de `exerciseVocab.ts`**, que va en la
 * dirección contraria: aquel traduce al español el vocabulario que la API de
 * ExerciseDB devuelve en inglés, para el catálogo público. Este traduce la
 * etiqueta de los ejercicios propios, que ya están en español.
 */
import type { TFunction } from 'i18next';
import { catalogKey } from './catalogKey';

export function equipmentLabel(equipo: string | null | undefined, t: TFunction): string {
  if (!equipo) return '';
  return t(`equipment.${catalogKey(equipo)}`, { defaultValue: equipo });
}
