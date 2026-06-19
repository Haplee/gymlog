import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { m } from 'framer-motion';
import { ArrowLeft, ChevronRight, Dumbbell } from 'lucide-react';
import { useAuthStore } from '@features/auth/stores/authStore';
import { Layout } from '@app/components/Layout';
import { fetchExerciseLibrary, type LibraryExercise } from '@shared/api/queries';

function ExerciseDetail({ ex }: { ex: LibraryExercise }) {
  const { t } = useTranslation();
  return (
    <div className="px-3 pb-3 pt-1 space-y-2">
      {ex.media_url && (
        <img
          src={ex.media_url}
          alt={ex.name}
          loading="lazy"
          className="w-full max-h-56 object-contain rounded-xl bg-surface-2"
        />
      )}
      <div className="flex flex-wrap gap-1.5">
        {ex.muscle_detail && (
          <span className="text-2xs px-2 py-1 rounded-pill bg-surface-2 text-fg-muted">
            {t('library.muscle')}: {ex.muscle_detail}
          </span>
        )}
        {ex.equipment && (
          <span className="text-2xs px-2 py-1 rounded-pill bg-surface-2 text-fg-muted">
            {t('library.equipment')}: {ex.equipment}
          </span>
        )}
        {ex.movement && (
          <span className="text-2xs px-2 py-1 rounded-pill bg-surface-2 text-fg-muted">
            {t('library.movement')}: {ex.movement}
          </span>
        )}
        {ex.is_compound && (
          <span className="text-2xs px-2 py-1 rounded-pill bg-accent/10 text-accent">
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: exercises = [] } = useQuery({
    queryKey: ['exerciseLibrary', user?.id],
    queryFn: () => fetchExerciseLibrary(user?.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.muscle_group?.toLowerCase().includes(q) ?? false) ||
        (e.muscle_detail?.toLowerCase().includes(q) ?? false),
    );
  }, [exercises, search]);

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
          className="w-11 h-11 rounded-xl flex items-center justify-center bg-surface border border-line hover:bg-surface-2"
        >
          <ArrowLeft className="w-4 h-4 text-fg-muted" />
        </button>
        <h1 className="text-xl font-extrabold text-fg text-balance">{t('library.title')}</h1>
      </m.div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('library.search')}
        aria-label={t('library.search')}
        className="w-full mb-3 rounded-lg text-base px-3 py-2.5 outline-none text-fg bg-surface border border-line-strong"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-fg-subtle">{t('library.empty')}</div>
      ) : (
        <div className="rounded-2xl overflow-hidden bg-surface border border-line">
          {filtered.map((ex) => {
            const expanded = expandedId === ex.id;
            return (
              <div key={ex.id} className="border-b border-line last:border-b-0">
                <button
                  onClick={() => setExpandedId(expanded ? null : ex.id)}
                  aria-expanded={expanded}
                  className="w-full px-3 py-3.5 flex items-center justify-between gap-3 text-left active:bg-hover"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Dumbbell className="w-4 h-4 flex-shrink-0 text-fg-subtle" />
                    <div className="min-w-0">
                      <div className="text-base font-medium text-fg truncate">{ex.name}</div>
                      <div className="text-2xs text-fg-subtle">{ex.muscle_group}</div>
                    </div>
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
