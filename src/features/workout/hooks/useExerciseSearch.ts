import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchExercises } from '@shared/api/queries';

interface UseExerciseSearchOptions {
  debounceMs?: number;
  userId: string | undefined;
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
    if (!debouncedQuery.trim()) return allExercises.slice(0, 50);
    return allExercises
      .map((ex) => ({ ex, score: fuzzyScore(debouncedQuery, ex.name) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ ex }) => ex)
      .slice(0, 30);
  }, [allExercises, debouncedQuery]);

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
    isLoading,
    isFocused,
    onFocus: handleFocus,
    onBlur: handleBlur,
  };
}
