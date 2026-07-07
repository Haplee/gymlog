import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { m } from 'framer-motion';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';
import { useAuthStore } from '@features/auth/stores/authStore';
import { Layout } from '@app/components/Layout';
import { fetchExerciseLibrary, type LibraryExercise } from '@shared/api/queries';
import { Chip } from '@shared/components/ui';

function ExerciseDetail({ ex }: { ex: LibraryExercise }) {
  const { t } = useTranslation();
  return (
    <div className="px-3 pb-3 pt-1 space-y-2.5">
      {ex.media_url && (
        <img
          src={ex.media_url}
          alt={ex.name}
          loading="lazy"
          className="w-full max-h-56 object-contain rounded-md bg-surface-2"
        />
      )}
      <div className="flex flex-wrap gap-1.5">
        {ex.muscle_detail && (
          <span className="label-caps px-2 py-1 rounded-sm bg-surface-2 text-fg-muted">
            {t('library.muscle')}: {ex.muscle_detail}
          </span>
        )}
        {ex.equipment && (
          <span className="label-caps px-2 py-1 rounded-sm bg-surface-2 text-fg-muted">
            {t('library.equipment')}: {ex.equipment}
          </span>
        )}
        {ex.movement && (
          <span className="label-caps px-2 py-1 rounded-sm bg-surface-2 text-fg-muted">
            {t('library.movement')}: {ex.movement}
          </span>
        )}
        {ex.is_compound && (
          <span className="label-caps px-2 py-1 rounded-sm bg-accent/10 text-accent">
            {t('library.compound')}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-fg-muted">
        {ex.description || t('library.no_description')}
      </p>
    </div>
  );
}

export function ExerciseLibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: exercises = [] } = useQuery({
    queryKey: ['exerciseLibrary', user?.id],
    queryFn: () => fetchExerciseLibrary(user?.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const muscleGroups = useMemo(() => {
    const set = new Set<string>();
    for (const e of exercises) {
      if (e.muscle_group) set.add(e.muscle_group);
    }
    return Array.from(set).toSorted((a, b) => a.localeCompare(b));
  }, [exercises]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter((e) => {
      if (muscleFilter && e.muscle_group !== muscleFilter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.muscle_group?.toLowerCase().includes(q) ?? false) ||
        (e.muscle_detail?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [exercises, search, muscleFilter]);

  return (
    <Layout>
      <m.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-4"
      >
        <button
          onClick={() => navigate(-1)}
          aria-label={t('common.back')}
          className="w-11 h-11 rounded-sm flex items-center justify-center bg-surface border border-line hover:bg-surface-2"
        >
          <ArrowLeft className="w-4 h-4 text-fg-muted" />
        </button>
        <h1 className="text-headline font-display text-fg text-balance">{t('library.title')}</h1>
      </m.div>

      <div className="relative mb-3">
        <Search className="absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('library.search')}
          aria-label={t('library.search')}
          className="w-full bg-transparent border-0 border-b border-line-strong rounded-none text-base pl-7 pr-2 py-2.5 outline-none text-fg placeholder:text-fg-subtle focus:border-accent transition-colors"
        />
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        <Chip selected={muscleFilter === null} onClick={() => setMuscleFilter(null)}>
          {t('library.all')}
        </Chip>
        {muscleGroups.map((mg) => (
          <Chip
            key={mg}
            selected={muscleFilter === mg}
            onClick={() => setMuscleFilter(muscleFilter === mg ? null : mg)}
          >
            {mg}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-fg-subtle">{t('library.empty')}</div>
      ) : (
        <div className="rounded-lg overflow-hidden bg-surface border border-line">
          {filtered.map((ex) => {
            const expanded = expandedId === ex.id;
            return (
              <div
                key={ex.id}
                className={`border-b border-line last:border-b-0 ${
                  expanded ? 'border-l-2 border-l-accent' : ''
                }`}
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : ex.id)}
                  aria-expanded={expanded}
                  className="w-full px-3 py-3.5 flex items-center justify-between gap-3 text-left active:bg-hover"
                >
                  <div className="min-w-0">
                    <div className="text-base font-medium text-fg truncate">{ex.name}</div>
                    {ex.muscle_group && (
                      <span className="label-caps inline-block mt-1 px-1.5 py-0.5 rounded-sm bg-surface-2 text-fg-subtle">
                        {ex.muscle_group}
                      </span>
                    )}
                  </div>
                  <ChevronRight
                    className="w-4 h-4 flex-shrink-0 text-fg-subtle transition-transform"
                    style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
                  />
                </button>
                {expanded && <ExerciseDetail ex={ex} />}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
