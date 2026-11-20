import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchExercises } from '@shared/api/queries';

interface UseExerciseSearchOptions {
  debounceMs?: number;
  userId: string | undefined;
}

const RECENT_KEY = 'gymlog-recent-exercises';
const MAX_RECENT = 8;

export function getRecentExerciseIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function trackRecentExercise(id: string) {
  const recent = [id, ...getRecentExerciseIds().filter((r) => r !== id)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

/**
 * Normaliza texto para búsqueda: minúsculas, trim, elimina diacríticos básicos.
 * En producción la BD usa `f_unaccent` + `pg_trgm`; aquí hacemos un fallback cliente.
 */
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // elimina marcas diacríticas (tildes, etc.)
    .replace(/\s+/g, ' ');
}

function fuzzyScore(query: string, text: string): number {
  const q = normalizeForSearch(query);
  const t = normalizeForSearch(text);
  if (t.includes(q)) return 3;
  if (t.startsWith(q)) return 2;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 1 : 0;
}

/**
 * Busca en nombre + aliases (si existen) para coincidencia difusa.
 */
function matchExercise(query: string, ex: { name: string; aliases?: string[] }): number {
  const nameScore = fuzzyScore(query, ex.name);
  if (nameScore === 3) return 3; // coincidencia exacta en nombre
  let best = nameScore;
  if (ex.aliases?.length) {
    for (const alias of ex.aliases) {
      const aliasScore = fuzzyScore(query, alias);
      if (aliasScore > best) best = aliasScore;
      if (best === 3) break;
    }
  }
  return best;
}

export function useExerciseSearch({ debounceMs = 250, userId }: UseExerciseSearchOptions) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reuses the same cache as WorkoutPage — zero extra network requests
  const { data: allExercises = [], isLoading } = useQuery({
    queryKey: ['exercises', userId],
    queryFn: () => fetchExercises(userId ?? ''),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const exercises = useMemo(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      const recentIds = getRecentExerciseIds();
      const recentSet = new Set(recentIds);
      const recent = recentIds
        .map((id) => allExercises.find((e) => e.id === id))
        .filter(Boolean) as typeof allExercises;
      const rest = allExercises.filter((e) => !recentSet.has(e.id)).slice(0, 50 - recent.length);
      return [...recent, ...rest];
    }
    return allExercises
      .map((ex) => ({ ex, score: matchExercise(trimmed, ex) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ ex }) => ex)
      .slice(0, 30);
  }, [allExercises, debouncedQuery]);

  const recentIds = useMemo(
    () => (debouncedQuery.trim() ? [] : getRecentExerciseIds()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedQuery, allExercises],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value);
      const trimmed = value.trim();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => setDebouncedQuery(trimmed), debounceMs);
    },
    [debounceMs],
  );

  // El cierre del desplegable se retrasa a propósito: sin esa espera, el blur
  // del campo lo desmonta antes de que el toque llegue al resultado que se
  // quería pulsar. Lo que faltaba era guardar el temporizador para poder
  // cancelarlo: si el foco vuelve dentro de esos 200 ms —al pulsar la X de
  // limpiar, o al volver al campo tras un roce fuera— el temporizador huérfano
  // vencía igual y apagaba el foco con el campo enfocado. El buscador se
  // quedaba escribible pero mudo: texto dentro, ningún resultado y ninguna
  // forma de recuperarlos salvo salir y volver a entrar.
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFocus = useCallback(() => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => setIsFocused(false), 200);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  return {
    query,
    setQuery: handleSearchChange,
    exercises,
    recentIds,
    isLoading,
    isFocused,
    onFocus: handleFocus,
    onBlur: handleBlur,
  };
}
