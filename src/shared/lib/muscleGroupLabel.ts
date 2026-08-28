/**
 * Nombre de un grupo muscular para MOSTRAR.
 *
 * El valor que se guarda en `exercises.muscle_group` es siempre el literal
 * español («Bíceps»): lo escribe el trigger `autoclassify_muscle_group` del
 * servidor y es la clave por la que se filtra, se agrupa y se pinta el color.
 * **No se traduce el dato, se traduce la etiqueta**, y solo en el momento de
 * pintarla — si se tradujera el valor, un filtro dejaría de encontrar sus
 * ejercicios en cuanto el usuario cambiase de idioma.
 *
 * Se vio recorriendo la APK en inglés: la app entera decía «No data yet:
 * Bíceps, Antebrazo, Tríceps» y «Core · Glúteo · Pierna» dentro de una interfaz
 * en inglés.
 */
import type { TFunction } from 'i18next';

/** Minúsculas y sin acentos: la clave i18n de «Glúteo» es `gluteo`. */
function claveDe(grupo: string): string {
  return grupo
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Traduce el grupo, o lo devuelve tal cual si no es uno de los del catálogo.
 *
 * El paso por `defaultValue` no es una precaución de manual: los grupos también
 * llegan de historiales importados de Strong o Hevy, donde el usuario ha podido
 * escribir cualquier cosa. Un grupo desconocido se enseña como vino, que es
 * mejor que enseñar la clave i18n o un hueco.
 */
export function muscleGroupLabel(grupo: string | null | undefined, t: TFunction): string {
  if (!grupo) return '';
  return t(`muscleGroups.${claveDe(grupo)}`, { defaultValue: grupo });
}
