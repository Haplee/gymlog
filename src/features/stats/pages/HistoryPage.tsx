import {
  ExerciseRow,
  WorkoutMeta,
  WorkoutSetsSummary,
} from '@features/stats/components/HistoryRows';
import { EditWorkoutModal } from '@features/stats/components/EditWorkoutModal';
import { HistoryFilters } from '@features/stats/components/HistoryFilters';
import { buildTemplateFromWorkouts } from '@features/stats/utils/historyHelpers';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { useCardioStore, CARDIO_LABELS } from '@features/cardio/stores/cardioStore';
import { Layout } from '@app/components/Layout';
import { useWeight } from '@shared/hooks/useWeight';
import { supabase } from '@shared/lib/supabase';
import { shareWorkoutImage } from '@shared/lib/shareImage';
import { formatDuration } from '@shared/lib/duration';
import { formatDisplayDate } from '@shared/lib/formatDate';
import type { WorkoutWithSets, WorkoutSetWithDetails } from '@shared/lib/types';
import { toast } from 'sonner';
import { fetchWorkouts, fetchRecentSets } from '@shared/api/queries';
import { EmptyHistory } from '@shared/components/EmptyStates';
import { SwipeToDelete } from '@shared/components/SwipeToDelete';
import { Modal, Button, ConfirmDialog } from '@shared/components/ui';
import { CardioTypeIcon } from '@shared/components/CardioIcons';
import { HEALTH_SESSIONS_KEY, fetchHealthSessions } from '@features/wearables/api/wearablesQueries';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useHistoryTransfer } from '@features/stats/hooks/useHistoryTransfer';
import {
  BookmarkAdd,
  Edit,
  HeartPulse,
  Repeat,
  Share,
  Trash2,
  Upload,
} from '@shared/components/icons';

interface GroupedWorkout {
  date: string;
  workouts: WorkoutWithSets[];
  totalSets: number;
  totalVolume: number;
}

export function HistoryPage() {
  const navigate = useNavigate();
  const { formatVol } = useWeight();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const repeatWorkout = useWorkoutStore((s) => s.repeatWorkout);
  const addRoutine = useRoutineStore((s) => s.addRoutine);
  const saveRoutinesToDb = useRoutineStore((s) => s.saveToDb);
  const cardioSessions = useCardioStore((s) => s.sessions);
  const deleteCardioSession = useCardioStore((s) => s.deleteSession);
  const syncCardio = useCardioStore((s) => s.syncFromRemote);
  const [view, setView] = useState<'all' | 'sets' | 'workouts' | 'cardio'>('all');
  const [filterExercise, setFilterExercise] = useState('');
  const [searchText, setSearchText] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editWorkout, setEditWorkout] = useState<WorkoutWithSets | null>(null);
  // Render incremental: limita los días montados y carga más al hacer scroll.
  const [visibleDays, setVisibleDays] = useState(12);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const {
    data: workouts = [],
    isLoading: loadingWorkouts,
    refetch: refetchWorkouts,
  } = useQuery({
    queryKey: ['workouts', user?.id],
    queryFn: () => fetchWorkouts(user?.id ?? ''),
    enabled: !!user?.id,
  });

  // Sesiones de gimnasio del agregador de salud: van en el timeline junto a los
  // workouts del mismo día (el reloj graba una sesión por visita; los workouts
  // los registra el usuario aparte, y pueden ser varios dentro de esa ventana).
  const { data: healthSessions = [] } = useQuery({
    queryKey: HEALTH_SESSIONS_KEY(user?.id ?? ''),
    queryFn: () => fetchHealthSessions(user?.id ?? ''),
    enabled: !!user?.id,
  });

  const {
    data: recentSets = [],
    isLoading: loadingSets,
    refetch: refetchSets,
  } = useQuery({
    queryKey: ['recentSets', user?.id],
    queryFn: () => fetchRecentSets(user?.id ?? ''),
    // Solo se necesita en la vista "Series": no bloquear la carga inicial (vista
    // "Todo") con una segunda query pesada de sets.
    enabled: !!user?.id && view === 'sets',
  });

  // El skeleton de carga inicial depende solo de workouts; recentSets carga
  // perezosamente al abrir la pestaña de series.
  const loading = loadingWorkouts;

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    void syncCardio(user.id);
  }, [user, navigate, syncCardio]);

  // Infinite scroll: monta más días cuando el sentinel entra en viewport.
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleDays((v) => v + 12);
      },
      { rootMargin: '400px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [view]);

  const handleRepeat = (workout: WorkoutWithSets) => {
    repeatWorkout(workout);
    navigate('/');
  };

  const handleSaveTemplate = (dayWorkouts: WorkoutWithSets[], label: string) => {
    const hasExercises = dayWorkouts.some((w) => w.sets.length > 0);
    if (!hasExercises) return;
    const name = `${t('history.template_prefix')} ${label}`;
    addRoutine(buildTemplateFromWorkouts(dayWorkouts, name));
    if (user) void saveRoutinesToDb(user.id);
    toast.success(t('history.template_saved'));
    navigate('/routines');
  };

  const exercises = [...new Set(recentSets.map((s) => s.exercise?.name).filter(Boolean))];

  const search = searchText.trim().toLowerCase();
  const filteredSets = recentSets
    .filter((s) => !filterExercise || s.exercise?.name === filterExercise)
    .filter((s) => {
      if (!search) return true;
      const name = s.exercise?.name?.toLowerCase() ?? '';
      const notes = s.notes?.toLowerCase() ?? '';
      return name.includes(search) || notes.includes(search);
    })
    .sort(
      (a, b) =>
        new Date(b.workout?.started_at ?? '').getTime() -
        new Date(a.workout?.started_at ?? '').getTime(),
    );

  const groupedWorkouts: GroupedWorkout[] = workouts.reduce((acc: GroupedWorkout[], wo) => {
    const date = formatDisplayDate(wo.started_at ?? '');
    const existing = acc.find((g) => g.date === date);
    const volume = wo.sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
    if (existing) {
      existing.workouts.push(wo);
      existing.totalSets += wo.sets.length;
      existing.totalVolume += volume;
    } else {
      acc.push({ date, workouts: [wo], totalSets: wo.sets.length, totalVolume: volume });
    }
    return acc;
  }, []);

  const handleDelete = async (id: string) => {
    await supabase.from('workout_sets').delete().eq('id', id);
    if (user) {
      refetchSets();
      refetchWorkouts();
      queryClient.invalidateQueries({ queryKey: ['lastExerciseSets'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['personalRecords'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['workoutsAndSets'], refetchType: 'all' });
    }
    setDeleteId(null);
  };

  // Exportacion/importacion del historial: extraida a un hook porque eran 463
  // lineas de orquestacion (XLSX, JSON y CSV) dentro de la pagina.
  const {
    exportToExcel,
    exportToJson,
    importFromJson,
    importFromCsv,
    importFromAppleHealth,
    pendingImport,
    pendingImportSummary,
    pendingImportSource,
    confirmImport,
    cancelImport,
  } = useHistoryTransfer({
    workouts,
    refetchSets,
    refetchWorkouts,
  });

  // Timeline unificado: fuerza + cardio + sesiones de salud mezclados por fecha
  type TimelineItem =
    | { kind: 'workout'; data: WorkoutWithSets; date: Date }
    | { kind: 'cardio'; data: (typeof cardioSessions)[0]; date: Date }
    | { kind: 'health'; data: (typeof healthSessions)[0]; date: Date };

  const timelineItems: TimelineItem[] = [
    ...workouts.map((wo): TimelineItem => ({
      kind: 'workout',
      data: wo,
      date: new Date(wo.started_at ?? ''),
    })),
    ...cardioSessions.map((s): TimelineItem => ({
      kind: 'cardio',
      data: s,
      date: new Date(s.startedAt),
    })),
    ...healthSessions.map((s): TimelineItem => ({
      kind: 'health',
      data: s,
      date: new Date(s.started_at),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  // Agrupar timeline por fecha local
  const timelineByDate: { date: string; items: TimelineItem[] }[] = [];
  timelineItems.forEach((item) => {
    const label = item.date.toLocaleDateString('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const last = timelineByDate[timelineByDate.length - 1];
    if (last?.date === label) {
      last.items.push(item);
    } else {
      timelineByDate.push({ date: label, items: [item] });
    }
  });

  if (loading) {
    return (
      <Layout>
        {/* Replica el layout real: filtros + grupos de tarjetas */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="skeleton h-10 w-36 rounded-card" />
            <div className="skeleton h-10 w-24 rounded-card" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-16 rounded-card" />
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <HistoryFilters
        view={view}
        onView={setView}
        searchText={searchText}
        onSearchText={setSearchText}
        filterExercise={filterExercise}
        onFilterExercise={setFilterExercise}
        exercises={exercises}
        onOpenStats={() => navigate('/stats')}
        onOpenUserStats={() => navigate('/user-stats')}
        exportToExcel={exportToExcel}
        exportToJson={exportToJson}
        importFromCsv={importFromCsv}
        importFromAppleHealth={importFromAppleHealth}
        importFromJson={importFromJson}
      />

      {view === 'all' ? (
        <div className="space-y-4">
          {timelineByDate.length === 0 ? (
            <EmptyHistory
              action={{ label: t('workout.start_cta'), onClick: () => navigate('/') }}
            />
          ) : (
            timelineByDate.slice(0, visibleDays).map((group) => (
              <div key={group.date}>
                <div className="px-1 mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-fg-subtle">
                    {group.date}
                  </span>
                  {group.items.some((it) => it.kind === 'workout') && (
                    <button
                      type="button"
                      onClick={() =>
                        handleSaveTemplate(
                          group.items.flatMap((it) =>
                            it.kind === 'workout' ? [it.data as WorkoutWithSets] : [],
                          ),
                          group.date,
                        )
                      }
                      className="flex items-center gap-1 text-2xs font-semibold text-fg-muted"
                      title={t('history.save_as_template')}
                    >
                      <BookmarkAdd className="w-3.5 h-3.5 text-accent" />
                      {t('history.save_as_template')}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {group.items.map((item) =>
                    item.kind === 'health' ? (
                      <div
                        key={item.data.id}
                        className="rounded-card p-3.5 flex items-center gap-3 bg-surface border border-line shadow-card"
                      >
                        <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 bg-accent/10 text-accent">
                          <HeartPulse className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-fg">
                              {item.data.title || t('history.gym_session')}
                            </span>
                            <span className="text-2xs px-1.5 py-0.5 rounded-sm font-bold bg-surface-2 text-fg-muted">
                              {t('cardio.health_source')}
                            </span>
                          </div>
                          <div className="text-xs flex items-center gap-2 mt-0.5 flex-wrap text-fg-muted">
                            <span className="font-mono tabular-nums font-semibold">
                              {formatDuration(item.data.duration)}
                            </span>
                            {item.data.calories ? (
                              <span>· {t('stats.kcal_suffix', { value: item.data.calories })}</span>
                            ) : null}
                            {item.data.avg_hr ? (
                              <span>
                                · {item.data.avg_hr}
                                {item.data.max_hr ? `/${item.data.max_hr}` : ''}{' '}
                                {t('wearables.bpm')}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : item.kind === 'cardio' ? (
                      <div
                        key={item.data.id}
                        className="rounded-card p-3.5 flex items-center justify-between bg-surface border border-line shadow-card transition-transform active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 bg-error/10 text-error">
                            <CardioTypeIcon type={item.data.type} className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-fg">
                                {CARDIO_LABELS[item.data.type]}
                              </span>
                              <span className="text-2xs px-1.5 py-0.5 rounded-sm font-bold bg-error/10 text-error">
                                {t('stats.cardio_badge')}
                              </span>
                            </div>
                            <div className="text-xs flex items-center gap-2 mt-0.5 text-fg-muted">
                              <span className="font-mono tabular-nums font-semibold">
                                {formatDuration(item.data.duration)}
                              </span>
                              {item.data.distance && (
                                <span>· {t('stats.km_suffix', { value: item.data.distance })}</span>
                              )}
                              {item.data.calories && (
                                <span>
                                  · {t('stats.kcal_suffix', { value: item.data.calories })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteCardioSession(item.data.id, user?.id ?? null)}
                          className="p-2 rounded-card ml-2 flex-shrink-0 text-fg-subtle"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        key={item.data.id}
                        className="rounded-card overflow-hidden bg-surface border border-line shadow-card"
                      >
                        <div className="px-3 py-2.5">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-fg">
                                {new Date(item.data.started_at ?? '').toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {/* Iba con relleno de acento sólido en cada fila:
                                  once insignias siendo lo más llamativo de la
                                  pantalla para decir algo que casi nunca cambia.
                                  Neutra, como la de «Salud» de este mismo
                                  listado, que ya lo hacía bien. */}
                              <span className="text-2xs px-1.5 py-0.5 rounded-pill font-bold bg-surface-2 text-fg-muted">
                                {t('stats.strength_badge')}
                              </span>
                            </div>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => setEditWorkout(item.data)}
                                className="flex items-center gap-1 text-xs font-semibold text-fg-muted"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                {t('history.edit')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRepeat(item.data)}
                                className="flex items-center gap-1 text-xs font-semibold text-fg-muted"
                              >
                                <Repeat className="w-3.5 h-3.5 text-accent" />
                                {t('history.repeat')}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const uniqueExercises = [
                                    ...new Set(item.data.sets.map((s) => s.exercise?.name)),
                                  ].length;
                                  const volume = item.data.sets.reduce(
                                    (sum, s) => sum + s.reps * s.weight,
                                    0,
                                  );
                                  const success = await shareWorkoutImage({
                                    exerciseCount: uniqueExercises,
                                    totalSets: item.data.sets.length,
                                    totalVolume: volume,
                                    date: formatDisplayDate(item.data.started_at ?? ''),
                                  });
                                  if (success) toast.success(t('history.shared_msg'));
                                  else toast.error('Error');
                                }}
                                className="flex items-center gap-1 text-xs font-semibold text-fg-muted"
                              >
                                <Share className="w-3.5 h-3.5" />
                                {t('history.share')}
                              </button>
                            </div>
                          </div>
                          <WorkoutSetsSummary sets={item.data.sets} />
                          <WorkoutMeta workout={item.data} />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))
          )}
          {visibleDays < timelineByDate.length && (
            <div ref={loadMoreRef} className="h-1" aria-hidden="true" />
          )}
        </div>
      ) : view === 'cardio' ? (
        <div className="space-y-2">
          {cardioSessions.length === 0 ? (
            <div className="text-center py-12 text-sm text-fg-subtle">
              {t('history.cardio_empty')}
            </div>
          ) : (
            cardioSessions.map((session) => (
              <SwipeToDelete
                key={session.id}
                onDelete={() => void deleteCardioSession(session.id, user?.id ?? null)}
              >
                <div className="p-4 flex items-center justify-between glass-2 rounded-card">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 bg-surface-2">
                      <span className="text-accent">
                        <CardioTypeIcon type={session.type} className="w-4.5 h-4.5" />
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-fg">
                          {CARDIO_LABELS[session.type]}
                        </span>
                        <span className="font-mono text-sm font-semibold text-accent">
                          {formatDuration(session.duration)}
                        </span>
                      </div>
                      <div className="text-xs flex items-center gap-2 text-fg-subtle">
                        <span>
                          {formatDistanceToNow(parseISO(session.startedAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                        {session.distance && (
                          <span>· {t('stats.km_suffix', { value: session.distance })}</span>
                        )}
                        {session.calories && (
                          <span>· {t('stats.kcal_suffix', { value: session.calories })}</span>
                        )}
                      </div>
                      {session.notes && (
                        <div className="text-xs italic mt-0.5 text-fg-subtle">{session.notes}</div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteCardioSession(session.id, user?.id ?? null)}
                    className="p-2 rounded-card ml-2 flex-shrink-0 text-fg-subtle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </SwipeToDelete>
            ))
          )}
        </div>
      ) : view === 'sets' ? (
        <div className="rounded-card overflow-hidden bg-surface border border-line-strong shadow-card">
          {loadingSets ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton h-10 rounded-card" />
              ))}
            </div>
          ) : filteredSets.length === 0 ? (
            <EmptyHistory
              action={{ label: t('workout.start_cta'), onClick: () => navigate('/') }}
            />
          ) : (
            (() => {
              const grouped: Record<string, Record<string, typeof filteredSets>> = {};
              filteredSets.forEach((s: WorkoutSetWithDetails) => {
                const date = s.workout?.started_at
                  ? formatDisplayDate(s.workout.started_at)
                  : 'Sin fecha';
                const exercise = s.exercise?.name || t('history.unknown_exercise');
                if (!grouped[date]) grouped[date] = {};
                if (!grouped[date][exercise]) grouped[date][exercise] = [];
                grouped[date][exercise].push(s);
              });

              const sortedDates = Object.keys(grouped).sort(
                (a, b) => new Date(b).getTime() - new Date(a).getTime(),
              );

              return (
                <div className="divide-y divide-line">
                  {sortedDates.map((date) => (
                    <div key={date}>
                      {/* Cabecera de fecha — mismo estilo que group headers del ExerciseSelector */}
                      <div className="px-3 py-2 flex items-center gap-1.5 sticky top-0 z-10 bg-surface-2 border-b border-line">
                        <span className="text-2xs font-bold uppercase tracking-[0.12em] text-fg-subtle">
                          {date}
                        </span>
                      </div>
                      {Object.entries(grouped[date]).map(([exercise, exerciseSets]) => (
                        <ExerciseRow
                          key={exercise}
                          exercise={exercise}
                          sets={exerciseSets}
                          onDelete={(id) => setDeleteId(id)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {groupedWorkouts.length === 0 ? (
            <EmptyHistory
              action={{ label: t('workout.start_cta'), onClick: () => navigate('/') }}
            />
          ) : (
            groupedWorkouts.map((group, gi) => (
              <div
                key={gi}
                className="rounded-card overflow-hidden bg-surface border border-line-strong shadow-card"
              >
                {/* Cabecera fecha/volumen */}
                <div className="px-3 py-2 flex justify-between items-center bg-surface-2 border-b border-line">
                  <span className="text-2xs font-bold uppercase tracking-[0.12em] text-fg-subtle">
                    {group.date}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-fg-subtle">
                      {t('stats.series_count', { count: group.totalSets })} ·{' '}
                      {formatVol(group.totalVolume)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSaveTemplate(group.workouts, group.date)}
                      className="flex items-center gap-1 text-xs font-semibold text-fg-muted"
                      aria-label={t('history.save_as_template')}
                    >
                      <BookmarkAdd className="w-3.5 h-3.5 text-accent" />
                    </button>
                  </div>
                </div>
                {group.workouts.map((wo) => (
                  <div key={wo.id} className="px-3 py-2.5 border-b border-line">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-fg-subtle">
                        {new Date(wo.started_at ?? '').toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setEditWorkout(wo)}
                          className="flex items-center gap-1 text-xs font-semibold text-fg-muted"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          {t('history.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRepeat(wo)}
                          className="flex items-center gap-1 text-xs font-semibold text-fg-muted"
                        >
                          <Repeat className="w-3.5 h-3.5 text-accent" />
                          {t('history.repeat')}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const uniqueExercises = [
                              ...new Set(wo.sets.map((s) => s.exercise?.name)),
                            ].length;
                            const volume = wo.sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
                            const success = await shareWorkoutImage({
                              exerciseCount: uniqueExercises,
                              totalSets: wo.sets.length,
                              totalVolume: volume,
                              date: formatDisplayDate(wo.started_at ?? ''),
                            });
                            if (success) toast.success(t('history.shared_msg'));
                            else toast.error('Error');
                          }}
                          className="flex items-center gap-1 text-xs font-semibold text-fg-muted"
                        >
                          <Share className="w-3.5 h-3.5" />
                          {t('history.share')}
                        </button>
                      </div>
                    </div>
                    <WorkoutSetsSummary sets={wo.sets} />
                    <WorkoutMeta workout={wo} />
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {editWorkout && (
        <EditWorkoutModal
          workout={editWorkout}
          onClose={() => setEditWorkout(null)}
          onSaved={() => {
            refetchSets();
            refetchWorkouts();
            queryClient.invalidateQueries({ queryKey: ['workoutsAndSets'], refetchType: 'all' });
            queryClient.invalidateQueries({ queryKey: ['personalRecords'], refetchType: 'all' });
            setEditWorkout(null);
          }}
        />
      )}

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={t('history.delete_confirm')}
        icon={<Trash2 className="w-5 h-5 text-error" />}
        variant="danger"
      >
        <p className="text-fg-muted mb-6">{t('history.delete_irreversible')}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => deleteId && handleDelete(deleteId)}
            className="flex-1"
            style={{ backgroundColor: 'var(--error)' }}
          >
            {t('common.delete')}
          </Button>
        </div>
      </Modal>

      {pendingImportSummary && pendingImport && (
        <ConfirmDialog
          open={pendingImport !== null}
          title={t('history.import_confirm_title')}
          variant="default"
          icon={<Upload className="w-5 h-5 text-accent" />}
          confirmLabel={t('history.import_confirm')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => void confirmImport()}
          onCancel={cancelImport}
          description={
            <div className="space-y-2">
              {pendingImportSource && (
                <p className="text-fg-muted">
                  {t('history.import_detected_source', { app: pendingImportSource.name })}
                </p>
              )}
              <p>
                {pendingImport.kind === 'json'
                  ? t('history.import_confirm_workouts', {
                      workouts: pendingImportSummary.workouts,
                      sets: pendingImportSummary.sets,
                    })
                  : pendingImport.kind === 'health'
                    ? t('history.health_confirm', { count: pendingImportSummary.weights ?? 0 })
                    : t('history.import_confirm_excel', {
                        sets: pendingImportSummary.sets,
                        cardio: pendingImportSummary.cardio,
                        routines: pendingImportSummary.routines,
                      })}
              </p>
              {pendingImport.kind === 'health' && (
                <p className="text-fg-muted">{t('history.health_only_gaps')}</p>
              )}
              {pendingImportSummary.skips > 0 && (
                <p className="text-warning">
                  {t('history.import_confirm_duplicates', {
                    count: pendingImportSummary.skips,
                  })}
                </p>
              )}
              {pendingImportSource && pendingImportSource.skippedRows > 0 && (
                <p className="text-fg-muted">
                  {t('history.import_skipped_rows', {
                    count: pendingImportSource.skippedRows,
                  })}
                </p>
              )}
            </div>
          }
        />
      )}
    </Layout>
  );
}
