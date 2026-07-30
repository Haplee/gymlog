import { ExerciseRow, WorkoutMeta } from '@features/stats/components/HistoryRows';
import { buildTemplateFromWorkouts } from '@features/stats/utils/historyHelpers';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { m } from 'framer-motion';
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
import { Modal, Button } from '@shared/components/ui';
import { CardioTypeIcon } from '@shared/components/CardioIcons';
import { HEALTH_SESSIONS_KEY, fetchHealthSessions } from '@features/wearables/api/wearablesQueries';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useHistoryTransfer } from '@features/stats/hooks/useHistoryTransfer';
import {
  Trash2,
  Repeat,
  Share2,
  BarChart2,
  BarChart3,
  Pencil,
  BookmarkPlus,
  HeartPulse,
} from 'lucide-react';
import { devError } from '@shared/lib/devtools';

interface GroupedWorkout {
  date: string;
  workouts: WorkoutWithSets[];
  totalSets: number;
  totalVolume: number;
}

interface EditRow {
  id: string;
  exercise: string;
  reps: string;
  weight: string;
}

function EditWorkoutModal({
  workout,
  onClose,
  onSaved,
}: {
  workout: WorkoutWithSets;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<EditRow[]>(() =>
    [...workout.sets]
      .sort((a, b) => a.set_num - b.set_num)
      .map((s) => ({
        id: s.id,
        exercise: s.exercise?.name ?? '',
        reps: String(s.reps),
        weight: String(s.weight),
      })),
  );
  const [saving, setSaving] = useState(false);

  const update = (id: string, field: 'reps' | 'weight', val: string) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [field]: val } : x)));

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        const reps = parseInt(row.reps, 10);
        const weight = parseFloat(row.weight.replace(',', '.'));
        if (!Number.isFinite(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0) continue;
        const { error } = await supabase
          .from('workout_sets')
          .update({ reps, weight })
          .eq('id', row.id);
        if (error) throw error;
      }
      toast.success(t('history.edit_saved'));
      onSaved();
    } catch (err) {
      devError('Error editing workout', err);
      toast.error(t('history.edit_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('history.edit_title')}
      icon={<Pencil className="w-5 h-5 text-accent" />}
    >
      <div className="space-y-2 max-h-[50vh] overflow-y-auto mb-4">
        {rows.map((row, i) => (
          <div key={row.id} className="flex items-center gap-2">
            <span className="w-5 text-xs font-mono tabular-nums text-fg-subtle">{i + 1}</span>
            <span className="flex-1 text-sm text-fg truncate">{row.exercise}</span>
            <input
              type="text"
              inputMode="numeric"
              value={row.reps}
              onChange={(e) => update(row.id, 'reps', e.target.value.replace(/[^\d]/g, ''))}
              aria-label={`${t('workout.reps')} ${i + 1}`}
              className="w-12 rounded-card text-sm font-mono tabular-nums px-2 py-1.5 text-center outline-none bg-surface-2 border border-line text-fg"
            />
            <span className="text-xs text-fg-subtle">×</span>
            <input
              type="text"
              inputMode="decimal"
              value={row.weight}
              onChange={(e) => update(row.id, 'weight', e.target.value.replace(/[^\d.,]/g, ''))}
              aria-label={`${t('workout.weight')} ${i + 1}`}
              className="w-16 rounded-card text-sm font-mono tabular-nums px-2 py-1.5 text-center outline-none bg-surface-2 border border-line text-fg"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving} className="flex-1">
          {t('common.save')}
        </Button>
      </div>
    </Modal>
  );
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
  const { exportToExcel, exportToJson, importFromJson, importFromCsv } = useHistoryTransfer({
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
      {/* Barra de filtros: scrollea con el contenido (no fija) */}
      <div className="mb-3 space-y-2">
        {/* Segmented control de vista — píldora deslizante */}
        <div
          role="tablist"
          aria-label="Vista del historial"
          className="flex p-1 rounded-sm bg-surface border border-line"
        >
          {(
            [
              { id: 'all', label: t('history.view_all') },
              { id: 'workouts', label: t('history.workouts_view') },
              { id: 'sets', label: t('history.sets_view') },
              { id: 'cardio', label: 'Cardio' },
            ] as const
          ).map((v) => {
            const active = view === v.id;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(v.id)}
                className={`relative flex-1 py-2.5 text-xs font-semibold rounded-sm transition-colors ${
                  active ? 'text-accent-fg' : 'text-fg-muted active:text-fg'
                }`}
              >
                {active && (
                  <m.div
                    layoutId="historyViewPill"
                    className="absolute inset-0 rounded-sm bg-accent shadow-btn-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative">{v.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/stats')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-pill font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] bg-accent text-accent-fg"
          >
            <BarChart3 className="w-4 h-4" />
            {t('stats.title')}
          </button>

          <button
            type="button"
            onClick={() => navigate('/user-stats')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-pill font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] bg-surface-2 text-accent"
          >
            <BarChart2 className="w-4 h-4" />
            {t('history.my_stats')}
          </button>

          {view === 'sets' && (
            <>
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t('history.search_placeholder')}
                aria-label={t('history.search_placeholder')}
                className="flex-1 min-w-[10rem] bg-surface border border-line-strong rounded-card text-fg text-base p-2 outline-none"
              />
              <select
                value={filterExercise}
                onChange={(e) => setFilterExercise(e.target.value)}
                className="bg-surface border border-line-strong rounded-card text-fg-muted text-base p-2 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <option value="">{t('history.filter_all')}</option>
                {exercises.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={exportToExcel}
                className="bg-surface border border-line-strong rounded-card text-accent text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {t('history.export_btn')}
              </button>
              <button
                type="button"
                onClick={exportToJson}
                className="bg-surface border border-line-strong rounded-card text-accent text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {t('history.export_json')}
              </button>
              <label className="bg-surface border border-line-strong rounded-card text-fg-muted text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]">
                {t('history.import_btn')}
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx"
                  onChange={importFromCsv}
                  className="hidden"
                />
              </label>
              <label className="bg-surface border border-line-strong rounded-card text-fg-muted text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]">
                {t('history.import_json')}
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={importFromJson}
                  className="hidden"
                />
              </label>
            </>
          )}
        </div>
      </div>

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
                      className="flex items-center gap-1 text-2xs font-semibold text-accent"
                      title={t('history.save_as_template')}
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
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
                            {item.data.calories ? <span>· {item.data.calories}kcal</span> : null}
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
                                Cardio
                              </span>
                            </div>
                            <div className="text-xs flex items-center gap-2 mt-0.5 text-fg-muted">
                              <span className="font-mono tabular-nums font-semibold">
                                {formatDuration(item.data.duration)}
                              </span>
                              {item.data.distance && <span>· {item.data.distance}km</span>}
                              {item.data.calories && <span>· {item.data.calories}kcal</span>}
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
                              <span className="text-2xs px-1.5 py-0.5 rounded-pill font-bold bg-accent text-accent-fg">
                                Fuerza
                              </span>
                            </div>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => setEditWorkout(item.data)}
                                className="flex items-center gap-1 text-xs font-semibold text-fg-muted"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                {t('history.edit')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRepeat(item.data)}
                                className="flex items-center gap-1 text-xs font-semibold text-accent"
                              >
                                <Repeat className="w-3.5 h-3.5" />
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
                                <Share2 className="w-3.5 h-3.5" />
                                {t('history.share')}
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {item.data.sets.map((s, si) => (
                              <span
                                key={si}
                                className="px-2 py-1 rounded-sm text-xs bg-surface-2 border border-line text-fg-muted"
                              >
                                {s.exercise?.name}: {s.reps}×{s.weight}
                              </span>
                            ))}
                          </div>
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
                <div className="p-4 flex items-center justify-between bg-surface border border-line rounded-card">
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
                        {session.distance && <span>· {session.distance}km</span>}
                        {session.calories && <span>· {session.calories}kcal</span>}
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
                      {group.totalSets} series · {formatVol(group.totalVolume)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSaveTemplate(group.workouts, group.date)}
                      className="flex items-center gap-1 text-xs font-semibold text-accent"
                      aria-label={t('history.save_as_template')}
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
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
                          <Pencil className="w-3.5 h-3.5" />
                          {t('history.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRepeat(wo)}
                          className="flex items-center gap-1 text-xs font-semibold text-accent"
                        >
                          <Repeat className="w-3.5 h-3.5" />
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
                          <Share2 className="w-3.5 h-3.5" />
                          {t('history.share')}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {wo.sets.map((s: WorkoutSetWithDetails, si) => (
                        <span
                          key={si}
                          className="px-2 py-1 rounded-sm text-xs bg-surface-2 border border-line text-fg-muted"
                        >
                          {s.exercise?.name}: {s.reps}×{s.weight}
                        </span>
                      ))}
                    </div>
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
    </Layout>
  );
}
