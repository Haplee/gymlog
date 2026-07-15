import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchExerciseById,
  fetchFeaturedExercises,
  searchExercises,
} from '@features/workout/api/exercisedb';
import { mapExerciseDbExercise, mapExerciseDbList } from '@features/workout/utils/mapExercise';

// El catálogo es prácticamente estático: cacheamos de forma agresiva.
const CATALOG_STALE_TIME = 1000 * 60 * 60; // 1 h

/** Debounce sencillo para no disparar una búsqueda por cada tecla. */
function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * Busca en el catálogo ExerciseDB. Con query vacía devuelve una selección
 * destacada (primera página) para no dejar la pantalla en blanco.
 */
export function useExerciseCatalog(rawQuery: string) {
  const query = useDebounced(rawQuery.trim());
  const isSearching = query.length >= 2;

  return useQuery({
    queryKey: ['exercisedb', 'search', isSearching ? query : '__featured__'],
    queryFn: async ({ signal }) => {
      const list = isSearching
        ? await searchExercises(query, signal)
        : await fetchFeaturedExercises(signal);
      return mapExerciseDbList(list);
    },
    staleTime: CATALOG_STALE_TIME,
    gcTime: CATALOG_STALE_TIME * 2,
    retry: 2,
  });
}

/** Detalle completo de un ejercicio del catálogo (músculos, equipo, pasos). */
export function useExerciseDetail(id: string | null) {
  return useQuery({
    queryKey: ['exercisedb', 'detail', id],
    queryFn: async ({ signal }) => {
      const raw = await fetchExerciseById(id as string, signal);
      return raw ? mapExerciseDbExercise(raw) : null;
    },
    enabled: !!id,
    staleTime: CATALOG_STALE_TIME,
    gcTime: CATALOG_STALE_TIME * 2,
    retry: 2,
  });
}
