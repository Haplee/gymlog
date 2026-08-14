import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useExerciseCatalog, useExerciseDetail } from '@features/workout/hooks/useExerciseCatalog';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { useAuthStore } from '@features/auth/stores/authStore';
import { createCustomExercise } from '@shared/api/exerciseMutations';
import { loadTypeFromEquipment } from '@shared/lib/loadType';
import {
  muscleGroupFromBodyPart,
  translateEquipment,
  translateMuscle,
} from '@features/workout/utils/exerciseVocab';
import { useTranslatedTexts } from '@features/workout/hooks/useTranslatedTexts';
import type { CatalogExercise } from '@features/workout/utils/mapExercise';
import { BookmarkAdd, ChevronRight, Dumbbell, Search } from '@shared/components/icons';

/** Imagen del catálogo con fallback a placeholder si falta o falla la carga. */
function CatalogMedia({
  src,
  alt,
  variant,
}: {
  src: string | null;
  alt: string;
  variant: 'thumb' | 'detail';
}) {
  const [failed, setFailed] = useState(false);
  const isThumb = variant === 'thumb';
  const box = isThumb
    ? 'w-11 h-11 flex-shrink-0 rounded-sm'
    : 'w-full max-h-56 aspect-video rounded-md';

  if (!src || failed) {
    return (
      <div className={`${box} bg-surface-2 flex items-center justify-center`} aria-hidden="true">
        <Dumbbell className={isThumb ? 'w-4 h-4 text-fg-subtle' : 'w-8 h-8 text-fg-subtle'} />
      </div>
    );
  }

  return (
    // onError cae al placeholder si el GIF falta o da 404.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${box} bg-surface-2 ${isThumb ? 'object-cover' : 'object-contain'}`}
    />
  );
}

function CatalogDetail({ id, name }: { id: string; name: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setCustomExerciseName = useWorkoutStore((s) => s.setCustomExerciseName);
  const setActiveExercise = useWorkoutStore((s) => s.setActiveExercise);
  const { data: detail, isLoading } = useExerciseDetail(id);

  const isEs = i18n.language.split('-')[0] === 'es';
  const loc = (v: string) => (isEs ? translateMuscle(v) : v);
  const locEquip = (v: string) => (isEs ? translateEquipment(v) : v);
  const insMap = useTranslatedTexts(detail?.instructions ?? [], i18n.language);

  const useInWorkout = () => {
    setActiveExercise(null);
    setCustomExerciseName(name);
    navigate('/');
  };

  const saveAsOwn = useMutation({
    mutationFn: () => {
      if (!user?.id || !detail) throw new Error('no data');
      const primary = muscleGroupFromBodyPart(detail.bodyParts[0] ?? '');
      const secondaryGroups = [
        ...new Set(detail.bodyParts.slice(1).map(muscleGroupFromBodyPart)),
      ].filter((g) => g !== primary);
      return createCustomExercise(user.id, {
        name,
        muscle_group: primary,
        secondaries: secondaryGroups.map((muscle_group) => ({ muscle_group, weight: 30 })),
        load_type: loadTypeFromEquipment(detail.equipment),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      queryClient.invalidateQueries({ queryKey: ['exerciseLibrary'] });
      toast.success(t('library.saved_as_own'));
    },
    onError: () => toast.error(t('library.save_error')),
  });

  return (
    <div className="px-3 pb-3 pt-1 space-y-2.5">
      {detail && <CatalogMedia src={detail.mediaUrl} alt={name} variant="detail" />}

      {isLoading && <div className="h-4 w-24 rounded-sm bg-surface-2 animate-pulse" />}

      {detail && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {detail.targetMuscles.map((m) => (
              <span key={m} className="label-caps px-2 py-1 rounded-sm bg-accent/10 text-accent">
                {t('library.target')}: {loc(m)}
              </span>
            ))}
            {detail.equipment.map((e) => (
              <span key={e} className="label-caps px-2 py-1 rounded-sm bg-surface-2 text-fg-muted">
                {t('library.equipment')}: {locEquip(e)}
              </span>
            ))}
            {detail.secondaryMuscles.length > 0 && (
              <span className="label-caps px-2 py-1 rounded-sm bg-surface-2 text-fg-muted">
                {t('library.secondary')}: {detail.secondaryMuscles.map(loc).join(', ')}
              </span>
            )}
          </div>

          {detail.videoUrl && (
            <a
              href={detail.videoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-block text-sm text-accent underline"
            >
              {t('library.video')}
            </a>
          )}

          {detail.instructions.length > 0 && (
            <ol className="list-decimal pl-5 space-y-1 text-sm leading-relaxed text-fg-muted">
              {detail.instructions.map((step, i) => (
                <li key={i}>{insMap[step] ?? step}</li>
              ))}
            </ol>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={useInWorkout}
              className="flex-1 min-h-11 rounded-md bg-accent text-accent-fg font-medium flex items-center justify-center gap-2 active:opacity-90"
            >
              <Dumbbell className="w-4 h-4" />
              {t('library.use_in_workout')}
            </button>
            <button
              type="button"
              onClick={() => saveAsOwn.mutate()}
              disabled={saveAsOwn.isPending}
              aria-label={t('library.save_as_own')}
              className="min-h-11 px-3 rounded-md bg-surface-2 text-fg-muted flex items-center justify-center gap-2 active:opacity-90 disabled:opacity-50"
            >
              <BookmarkAdd className="w-4 h-4" />
              {t('library.save_as_own')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ExerciseCatalog() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: results = [], isLoading, isError, refetch } = useExerciseCatalog(search);
  const nameMap = useTranslatedTexts(
    results.map((r) => r.name),
    i18n.language,
  );

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('library.catalog_search')}
          aria-label={t('library.catalog_search')}
          className="w-full bg-transparent border-0 border-b border-line-strong rounded-none text-base pl-7 pr-2 py-2.5 outline-none text-fg placeholder:text-fg-subtle focus:border-accent transition-colors"
        />
      </div>

      {isError ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm text-fg-subtle">{t('library.catalog_error')}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-11 px-4 rounded-md bg-surface-2 text-fg text-sm active:opacity-90"
          >
            {t('library.retry')}
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-md bg-surface-2 animate-pulse" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-12 text-sm text-fg-subtle">
          {search.trim().length >= 2 ? t('library.catalog_empty') : t('library.catalog_hint')}
        </div>
      ) : (
        <div className="rounded-card overflow-hidden bg-surface border border-line">
          {results.map((ex: CatalogExercise) => {
            const expanded = expandedId === ex.id;
            return (
              <div
                key={ex.id}
                className={`border-b border-line last:border-b-0 ${
                  expanded ? 'border-l-2 border-l-accent' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : ex.id)}
                  aria-expanded={expanded}
                  className="w-full min-h-11 px-3 py-2.5 flex items-center gap-3 text-left active:bg-hover"
                >
                  <CatalogMedia src={ex.mediaUrl} alt="" variant="thumb" />
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-medium text-fg truncate capitalize">
                      {nameMap[ex.name] ?? ex.name}
                    </div>
                    <span className="label-caps inline-block mt-0.5 px-1.5 py-0.5 rounded-sm bg-surface-2 text-fg-subtle">
                      {t('library.source_catalog')}
                    </span>
                  </div>
                  <ChevronRight
                    className="w-4 h-4 flex-shrink-0 text-fg-subtle transition-transform"
                    style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
                  />
                </button>
                {expanded && <CatalogDetail id={ex.id} name={nameMap[ex.name] ?? ex.name} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
