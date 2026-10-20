/**
 * Filtrado, búsqueda y agrupación de la biblioteca de ejercicios.
 *
 * Vive fuera del componente por dos motivos: es la parte con reglas —y por
 * tanto la única que se puede probar sin montar React— y es la que más se
 * recalcula en cada tecla, así que el componente solo la llama dentro de
 * `useMemo`.
 *
 * Los filtros son **adaptativos**: las opciones de cada eje se calculan sobre lo
 * que dejan los demás ejes. Con listas fijas, «Pecho» + «Mancuernas» puede dar
 * cero resultados y la pantalla se queda vacía sin decir cuál de los dos chips
 * sobra. Calculando cada eje sin aplicarse a sí mismo, cualquier chip que se
 * pueda tocar lleva a algo.
 *
 * Este módulo no traduce: devuelve valores del catálogo («Pecho», «Mancuernas»)
 * que el componente pinta con `muscleGroupLabel`/`equipmentLabel`. El valor
 * guardado es español y se filtra por él; traducir el valor dejaría los filtros
 * sin encontrar nada al cambiar de idioma.
 */
import { EQUIPMENT_TYPES } from '@shared/constants/equipment';
import { MUSCLE_GROUPS } from '@shared/constants/muscleGroups';
import type { LibraryExercise } from '@shared/api/queries';

/** Eje «compuesto / aislado». `isolation` incluye lo que no está marcado. */
export type CompoundFilter = 'all' | 'compound' | 'isolation';

export interface ExerciseFilterState {
  /** Texto del buscador, tal cual lo escribió el usuario. */
  query: string;
  /** Valor exacto de `muscle_group`, o `null` para «todos». */
  muscleGroup: string | null;
  /** Valor exacto de `equipment`, o `null` para «todo el material». */
  equipment: string | null;
  compound: CompoundFilter;
}

/** Estado inicial: sin nada filtrado. Fuente única para el botón «Limpiar». */
export const EMPTY_FILTERS: ExerciseFilterState = {
  query: '',
  muscleGroup: null,
  equipment: null,
  compound: 'all',
};

export interface FilterOption {
  value: string;
  /** Cuántos ejercicios quedarían si se eligiera esta opción. */
  count: number;
}

/**
 * Normaliza texto para comparar: minúsculas y sin acentos.
 *
 * Buscar «gluteo» tiene que encontrar «Glúteo» y buscar «biceps» «Bíceps»: en un
 * teclado de móvil la tilde es una molestia y quien busca rápido no la pone.
 */
export function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * ¿Encaja el ejercicio con el texto buscado?
 *
 * Mira nombre, grupo, detalle y material —no solo el nombre—: escribir «mancuerna»
 * para ver todo lo que se hace con mancuernas es una búsqueda que la gente hace.
 */
export function matchesQuery(exercise: LibraryExercise, rawQuery: string): boolean {
  return matchesNormalizedQuery(exercise, normalize(rawQuery));
}

function matchesNormalizedQuery(exercise: LibraryExercise, query: string): boolean {
  if (!query) return true;
  const campos = [exercise.name, exercise.muscle_group, exercise.muscle_detail, exercise.equipment];
  return campos.some((campo) => campo != null && normalize(campo).includes(query));
}

/** ¿Este ejercicio pasa el filtro de compuesto/aislado? */
function matchesCompound(exercise: LibraryExercise, filter: CompoundFilter): boolean {
  if (filter === 'all') return true;
  // `is_compound` puede ser null en filas antiguas o importadas. «Aislado» es el
  // lado seguro: lo que no está marcado como compuesto no se anuncia como tal.
  if (filter === 'compound') return exercise.is_compound === true;
  return exercise.is_compound !== true;
}

/** Eje que se ignora al calcular las opciones de ese mismo eje. */
type FilterAxis = 'muscleGroup' | 'equipment' | 'compound';

function matchesExcept(
  exercise: LibraryExercise,
  filters: ExerciseFilterState,
  query: string,
  skip: FilterAxis | null,
): boolean {
  if (!matchesNormalizedQuery(exercise, query)) return false;
  if (
    skip !== 'muscleGroup' &&
    filters.muscleGroup &&
    exercise.muscle_group !== filters.muscleGroup
  )
    return false;
  if (skip !== 'equipment' && filters.equipment && exercise.equipment !== filters.equipment)
    return false;
  if (skip !== 'compound' && !matchesCompound(exercise, filters.compound)) return false;
  return true;
}

/** La lista ya filtrada por todos los ejes a la vez. */
export function filterExercises(
  exercises: readonly LibraryExercise[],
  filters: ExerciseFilterState,
): LibraryExercise[] {
  const query = normalize(filters.query);
  return exercises.filter((exercise) => matchesExcept(exercise, filters, query, null));
}

/** ¿Hay algo filtrado? Es lo que decide si se pinta el botón de limpiar. */
export function hasActiveFilters(filters: ExerciseFilterState): boolean {
  return (
    normalize(filters.query) !== '' ||
    filters.muscleGroup !== null ||
    filters.equipment !== null ||
    filters.compound !== 'all'
  );
}

/** Recuento por grupo muscular de la lista que se le pase. */
export function countByMuscleGroup(exercises: readonly LibraryExercise[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const exercise of exercises) {
    if (!exercise.muscle_group) continue;
    counts.set(exercise.muscle_group, (counts.get(exercise.muscle_group) ?? 0) + 1);
  }
  return counts;
}

/** Recuento por material de la lista que se le pase. */
export function countByEquipment(exercises: readonly LibraryExercise[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const exercise of exercises) {
    if (!exercise.equipment) continue;
    counts.set(exercise.equipment, (counts.get(exercise.equipment) ?? 0) + 1);
  }
  return counts;
}

/**
 * Ordena los valores del catálogo primero y deja los desconocidos al final.
 *
 * Se sigue el orden canónico (el de `MUSCLE_GROUPS` / `EQUIPMENT_TYPES`) y no el
 * alfabético por etiqueta: es el mismo orden que usa el resto de la app
 * (`MuscleGroupPills`), y así la fila de filtros no cambia de sitio al cambiar de
 * idioma. Lo que no está en el catálogo —grupos de historiales importados— va
 * detrás, en orden alfabético, para que su posición sea al menos predecible.
 */
function canonicalOrder(values: Iterable<string>, canonical: readonly string[]): string[] {
  const present = new Set(values);
  const known = canonical.filter((value) => present.has(value));
  const extras = [...present]
    .filter((value) => !canonical.includes(value))
    .toSorted((a, b) => a.localeCompare(b));
  return [...known, ...extras];
}

function toOptions(counts: Map<string, number>, canonical: readonly string[]): FilterOption[] {
  return canonicalOrder(counts.keys(), canonical).map((value) => ({
    value,
    count: counts.get(value) ?? 0,
  }));
}

/**
 * Grupos musculares disponibles, con su recuento.
 *
 * El filtro de músculo se aplica a sí mismo con excepción: si se aplicara, al
 * elegir «Pecho» desaparecerían los demás grupos y no habría forma de cambiar de
 * opinión sin limpiar antes. Y el grupo activo se conserva aunque se quede sin
 * resultados: quitarle el chip de debajo al usuario deja la pantalla vacía sin
 * nada que pulsar para volver.
 */
export function availableMuscleGroups(
  exercises: readonly LibraryExercise[],
  filters: ExerciseFilterState,
): FilterOption[] {
  const query = normalize(filters.query);
  const elegibles = exercises.filter((exercise) =>
    matchesExcept(exercise, filters, query, 'muscleGroup'),
  );
  const counts = countByMuscleGroup(elegibles);
  if (filters.muscleGroup) {
    counts.set(filters.muscleGroup, counts.get(filters.muscleGroup) ?? 0);
  }
  return toOptions(counts, MUSCLE_GROUPS);
}

/** Material disponible, con su recuento. Mismo criterio adaptativo que arriba. */
export function availableEquipments(
  exercises: readonly LibraryExercise[],
  filters: ExerciseFilterState,
): FilterOption[] {
  const query = normalize(filters.query);
  const elegibles = exercises.filter((exercise) =>
    matchesExcept(exercise, filters, query, 'equipment'),
  );
  const counts = countByEquipment(elegibles);
  if (filters.equipment) {
    counts.set(filters.equipment, counts.get(filters.equipment) ?? 0);
  }
  return toOptions(counts, EQUIPMENT_TYPES);
}

/**
 * Recuento de cada opción de compuesto/aislado sobre lo que dejan los otros
 * ejes. `all` es el total, así que sirve también de recuento de resultados.
 */
export function countByCompoundFilter(
  exercises: readonly LibraryExercise[],
  filters: ExerciseFilterState,
): Record<CompoundFilter, number> {
  const query = normalize(filters.query);
  const elegibles = exercises.filter((exercise) =>
    matchesExcept(exercise, filters, query, 'compound'),
  );
  let compound = 0;
  for (const exercise of elegibles) {
    if (exercise.is_compound === true) compound += 1;
  }
  return {
    all: elegibles.length,
    compound,
    isolation: elegibles.length - compound,
  };
}
