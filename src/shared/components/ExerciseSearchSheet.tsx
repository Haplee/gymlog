import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { m } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import {
  fetchExerciseLibrary,
  fetchFavoriteExerciseIds,
  toggleFavoriteExercise,
} from '@shared/api/queries';
import { MUSCLE_COLORS } from '@shared/constants/muscleColors';
import { Chip } from '@shared/components/ui';
import { IconSearch, IconDumbbell, IconBook, IconStar } from '@shared/components/icons';

interface ExerciseSearchSheetProps {
  onClose: () => void;
}

/**
 * Búsqueda de ejercicios de la lupa de la cabecera.
 *
 * No es la biblioteca: allí se consulta la ficha de un ejercicio, aquí se
 * busca uno para *empezar a entrenarlo* — al tocarlo queda como ejercicio
 * activo y te deja en Entrenar. Por eso ordena poniendo delante lo que el
 * nombre empieza por lo escrito y filtra por grupo muscular con el color de
 * cada grupo, que es el idioma visual del resto de la app.
 */
export function ExerciseSearchSheet({ onClose }: ExerciseSearchSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const setActiveExercise = useWorkoutStore((s) => s.setActiveExercise);
  const addSet = useWorkoutStore((s) => s.addSet);
  const sets = useWorkoutStore((s) => s.sets);

  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: favoriteIds = [] } = useQuery({
    queryKey: ['exerciseFavorites', user?.id],
    queryFn: () => fetchFavoriteExerciseIds(user?.id ?? ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const toggleFavorite = useMutation({
    mutationFn: ({ id, isFav }: { id: string; isFav: boolean }) =>
      toggleFavoriteExercise(user?.id ?? '', id, isFav),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exerciseFavorites', user?.id] }),
  });

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['exerciseLibrary', user?.id],
    queryFn: () => fetchExerciseLibrary(user?.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Esc cierra: en la PWA de escritorio es lo que se espera de una hoja modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const muscleGroups = useMemo(() => {
    const set = new Set<string>();
    for (const e of exercises) if (e.muscle_group) set.add(e.muscle_group);
    return Array.from(set).toSorted((a, b) => a.localeCompare(b));
  }, [exercises]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = exercises.filter((e) => {
      if (onlyFavorites && !favorites.has(e.id)) return false;
      if (muscle && e.muscle_group !== muscle) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.muscle_group?.toLowerCase().includes(q) ?? false) ||
        (e.muscle_detail?.toLowerCase().includes(q) ?? false)
      );
    });
    if (!q) return matched.slice(0, 40);
    // Lo que empieza por lo escrito va primero; buscar "press" debe dar antes
    // "Press banca" que "Aperturas en press".
    return matched
      .toSorted((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
      })
      .slice(0, 40);
  }, [exercises, query, muscle, onlyFavorites, favorites]);

  const handlePick = (id: string) => {
    setActiveExercise(id);
    if (!sets.length) addSet();
    onClose();
    navigate('/');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <m.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="flex min-h-0 flex-1 flex-col"
        style={{ paddingTop: 'var(--inset-top, env(safe-area-inset-top))' }}
      >
        {/* Barra de búsqueda: pill de acento, como el resto de la app */}
        <div className="flex items-center gap-2 px-4 py-3">
          {/* El foco lo pinta el contenedor para que siga la forma de píldora. */}
          <div className="flex flex-1 items-center gap-2.5 rounded-pill bg-surface-2 px-4 focus-within:ring-2 focus-within:ring-accent/30">
            <IconSearch className="h-4 w-4 flex-shrink-0 text-accent" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
              className="min-h-11 w-full bg-transparent text-base text-fg shadow-none outline-none placeholder:text-fg-subtle focus:shadow-none"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-muted active:opacity-70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filtro por grupo muscular */}
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-3">
          <Chip selected={onlyFavorites} onClick={() => setOnlyFavorites((v) => !v)}>
            <IconStar className="h-3.5 w-3.5" />
            {t('search.favorites')}
          </Chip>
          <Chip selected={muscle === null} onClick={() => setMuscle(null)}>
            {t('library.all')}
          </Chip>
          {muscleGroups.map((g) => (
            <Chip key={g} selected={muscle === g} onClick={() => setMuscle(g)}>
              {g}
            </Chip>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-fg-subtle">{t('common.loading')}</p>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <IconSearch className="h-8 w-8 text-fg-subtle" />
              <p className="text-sm text-fg-muted">{t('search.empty')}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {results.map((ex) => {
                const color = MUSCLE_COLORS[ex.muscle_group] ?? MUSCLE_COLORS.Otro;
                const isFav = favorites.has(ex.id);
                return (
                  <li key={ex.id} className="relative">
                    <button
                      type="button"
                      onClick={() => handlePick(ex.id)}
                      className="flex w-full items-center gap-3 rounded-card bg-surface p-3 pr-14 text-left active:opacity-70"
                    >
                      <span
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${color}22`, color }}
                      >
                        <IconDumbbell className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-fg">
                          {ex.name}
                        </span>
                        <span className="block truncate text-xs text-fg-subtle">
                          {ex.muscle_detail || ex.muscle_group}
                        </span>
                      </span>
                      <span className="label-caps flex-shrink-0 rounded-pill bg-accent px-2.5 py-1 text-accent-fg">
                        {t('search.train')}
                      </span>
                    </button>
                    {/* Fuera del botón de "entrenar": son dos acciones distintas. */}
                    <button
                      type="button"
                      onClick={() => toggleFavorite.mutate({ id: ex.id, isFav })}
                      aria-pressed={isFav}
                      aria-label={t('search.favorite_toggle', { name: ex.name })}
                      className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center active:opacity-70"
                    >
                      <IconStar
                        className={`h-4 w-4 ${isFav ? 'text-accent' : 'text-fg-subtle/40'}`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/exercises');
            }}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-pill bg-surface-2 text-sm text-fg-muted active:opacity-70"
          >
            <IconBook className="h-4 w-4 text-accent" />
            {t('search.open_library')}
          </button>
        </div>
      </m.div>
    </div>
  );
}
