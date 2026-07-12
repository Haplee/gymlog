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

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return 2;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 1 : 0;
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
    if (!debouncedQuery.trim()) {
      const recentIds = getRecentExerciseIds();
      const recentSet = new Set(recentIds);
      const recent = recentIds
        .map((id) => allExercises.find((e) => e.id === id))
        .filter(Boolean) as typeof allExercises;
      const rest = allExercises.filter((e) => !recentSet.has(e.id)).slice(0, 50 - recent.length);
      return [...recent, ...rest];
    }
    return allExercises
      .map((ex) => ({ ex, score: fuzzyScore(debouncedQuery, ex.name) }))
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
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => setDebouncedQuery(value), debounceMs);
    },
    [debounceMs],
  );

  const handleFocus = useCallback(() => setIsFocused(true), []);

  const handleBlur = useCallback(() => {
    setTimeout(() => setIsFocused(false), 200);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
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
