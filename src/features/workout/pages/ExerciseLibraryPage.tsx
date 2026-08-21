import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAuthStore } from '@features/auth/stores/authStore';
import { Layout } from '@app/components/Layout';
import { fetchExerciseLibrary, type LibraryExercise } from '@shared/api/queries';
import { Chip, PageHeader, SegmentedControl } from '@shared/components/ui';
import { ExerciseCatalog } from '@features/workout/components/ExerciseCatalog';
import { EquipmentIcon } from '@shared/components/icons/EquipmentIcons';
import { LoadTypeBadge } from '@shared/components/LoadTypeBadge';
import { ChevronRight, Search } from '@shared/components/icons';

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
        <LoadTypeBadge loadType={ex.load_type} className="px-2 py-1" />
        {ex.muscle_detail && (
          <span className="label-caps px-2 py-1 rounded-sm bg-surface-2 text-fg-muted">
            {t('library.muscle')}: {ex.muscle_detail}
          </span>
        )}
        {ex.equipment && (
          <span className="label-caps px-2 py-1 rounded-sm bg-surface-2 text-fg-muted inline-flex items-center gap-1">
            <EquipmentIcon equipment={ex.equipment} className="w-3.5 h-3.5" />
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
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'own' | 'catalog'>('own');
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

  // Virtualización de la lista.
  //
  // El scroller NO es esta lista, es el <main> del Layout: la página entera
  // scrollea junta y meter un scroll anidado en móvil se pelea con el gesto del
  // sistema. Por eso hay que localizar ese ancestro y decirle al virtualizador
  // cuánto contenido hay por encima de la lista (`scrollMargin`), o calcularía
  // las posiciones desplazadas.
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const hasResults = filtered.length > 0;

  useEffect(() => {
    setScrollEl(listRef.current?.closest('main') ?? null);
  }, [tab, hasResults]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !scrollEl) return;
    // offsetTop no sirve: el offsetParent no tiene por qué ser el <main>.
    const offset =
      list.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
    setScrollMargin(offset);
  }, [scrollEl, tab, hasResults, muscleGroups.length]);

  // El aviso es inherente a la API de TanStack Virtual (devuelve funciones que
  // el compilador de React no puede memoizar); no hay forma de arreglarlo desde
  // aquí y silenciarlo puntualmente mantiene el lint limpio.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollEl,
    // Altura de una fila colapsada; las expandidas se miden de verdad con
    // measureElement, que es lo que permite que la ficha crezca sin descuadrar.
    estimateSize: () => 72,
    overscan: 8,
    scrollMargin,
    getItemKey: (index) => filtered[index].id,
  });

  return (
    <Layout>
      <PageHeader
        title={t('library.title')}
        onBack={() => navigate(-1)}
        backLabel={t('common.back')}
      />

      <div className="mb-4">
        <SegmentedControl
          ariaLabel={t('library.title')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'own', label: t('library.tab_own') },
            { value: 'catalog', label: t('library.tab_catalog') },
          ]}
        />
      </div>

      {tab === 'catalog' ? (
        <ExerciseCatalog />
      ) : (
        <>
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
            <div
              ref={listRef}
              className="rounded-card overflow-hidden bg-surface border border-line"
            >
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map((item) => {
                  const ex = filtered[item.index];
                  const expanded = expandedId === ex.id;
                  // `last:` ya no sirve: la última fila montada no es la última
                  // de la lista. Se decide por índice.
                  const isLast = item.index === filtered.length - 1;
                  return (
                    <div
                      key={item.key}
                      data-index={item.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${item.start - scrollMargin}px)`,
                      }}
                      className={`${isLast ? '' : 'border-b border-line'} ${
                        expanded ? 'border-l-2 border-l-accent' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : ex.id)}
                        aria-expanded={expanded}
                        className="w-full px-3 py-3.5 flex items-center justify-between gap-3 text-left active:bg-hover"
                      >
                        <div className="min-w-0">
                          <div className="text-base font-medium text-fg truncate">{ex.name}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ex.muscle_group && (
                              <span className="label-caps inline-block px-1.5 py-0.5 rounded-sm bg-surface-2 text-fg-subtle">
                                {ex.muscle_group}
                              </span>
                            )}
                            <LoadTypeBadge loadType={ex.load_type} />
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
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
