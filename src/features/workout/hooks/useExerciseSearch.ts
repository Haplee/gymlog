import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchExercises, fetchExercisesSearch } from '../api/workoutMutations';

interface UseExerciseSearchOptions {
  debounceMs?: number;
  userId: string | undefined;
}

export function useExerciseSearch({ debounceMs = 300, userId }: UseExerciseSearchOptions) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['exerciseSearch', query, userId],
    queryFn: () => searchExercises(query, userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: allExercises = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['exercisesList', userId],
    queryFn: () => fetchExercisesSearch(userId),
    enabled: !!userId && isFocused && !query,
    staleTime: 1000 * 60 * 5,
  });

  const displayedExercises = isFocused && !query ? allExercises : searchResults;
  const isLoading = isSearching || isLoadingAll;

  const handleSearchChange = useCallback(
    (value: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        setQuery(value);
      }, debounceMs);
    },
    [debounceMs],
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setTimeout(() => setIsFocused(false), 200);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    query,
    setQuery: handleSearchChange,
    exercises: displayedExercises,
    isLoading,
    isFocused,
    onFocus: handleFocus,
    onBlur: handleBlur,
  };
}
