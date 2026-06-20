import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { m } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import {
  useRoutineStore,
  type Routine,
  type DayOfWeek,
  type RoutineExercise,
} from '@features/routine/stores/routineStore';
import { useCardioStore, CARDIO_LABELS } from '@features/cardio/stores/cardioStore';
import { Layout } from '@app/components/Layout';
import { supabase } from '@shared/lib/supabase';
import { shareWorkoutImage } from '@shared/lib/shareImage';
import type { WorkoutWithSets, WorkoutSetWithDetails } from '@shared/lib/types';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { fetchWorkouts, fetchRecentSets, fetchExercises } from '@shared/api/queries';
import { EmptyHistory } from '@shared/components/EmptyStates';
import { SwipeToDelete } from '@shared/components/SwipeToDelete';
import { Modal, Button } from '@shared/components/ui';
import { CardioTypeIcon } from '@shared/components/CardioIcons';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  tokenizeCsvLine,
  parseImportNumber as parseNumber,
  parseImportDate as parseDate,
  isHeaderLine,
  buildExportCsv,
  buildExportJson,
} from '@features/stats/utils/exportImport';
import {
  ChevronRight,
  Trash2,
  Repeat,
  Share2,
  BarChart2,
  Pencil,
  Star,
  BookmarkPlus,
} from 'lucide-react';
import { devError } from '@shared/lib/devtools';

interface GroupedWorkout {
  date: string;
  workouts: WorkoutWithSets[];
  totalSets: number;
  totalVolume: number;
}

function ExerciseRow({
  exercise,
  sets,
  onDelete,
}: {
  exercise: string;
  sets: WorkoutSetWithDetails[];
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const sortedSets = [...sets].sort((a, b) => a.set_num - b.set_num);
  const firstSet = sortedSets[0];

  return (
    <div className="last:border-b-0 border-b border-line">
      <div
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        className="px-3 py-3 flex justify-between items-center cursor-pointer transition-colors hover:bg-hover active:bg-hover"
      >
        <div className="flex items-center gap-3">
          <ChevronRight
            className="w-4 h-4 flex-shrink-0 transition-transform"
            style={{
              color: 'var(--text-tertiary)',
              transform: expanded ? 'rotate(90deg)' : 'none',
            }}
          />
          <span className="text-base font-medium text-fg">{exercise}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xs px-1.5 py-0.5 rounded-pill font-bold font-mono tabular-nums bg-accent/10 text-accent border border-line-accent">
            {sortedSets.length} {t('history.series_plural')}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(firstSet.id);
            }}
            className="p-1.5 rounded-lg transition-colors text-fg-subtle hover:bg-error/10 active:bg-error/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {sortedSets.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-1 px-3 py-2 rounded-xl ml-7 bg-surface-2 border border-line"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-fg-subtle">
                    {t('workout.sets')} {s.set_num}
                  </span>
                  <span className="text-sm text-fg-muted">
                    {s.reps} {t('workout.reps').toLowerCase()}
                  </span>
                  {s.is_warmup && (
                    <span className="text-2xs px-1.5 py-0.5 rounded-pill font-bold uppercase bg-warning/15 text-warning">
                      W
                    </span>
                  )}
                  {typeof s.rpe === 'number' && (
                    <span className="text-[0.5625rem] px-1.5 py-0.5 rounded-pill font-bold bg-surface-3 text-fg-muted">
                      RPE {s.rpe}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums font-semibold text-sm text-accent">
                    {s.weight} kg
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    className="p-1 rounded text-fg-subtle"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {s.notes && <div className="text-xs italic pl-1 text-fg-subtle">“{s.notes}”</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkoutMeta({ workout }: { workout: WorkoutWithSets }) {
  const rating = workout.rating ?? null;
  const notes = workout.notes?.trim();
  if (!rating && !notes) return null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      {rating ? (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`w-3.5 h-3.5 ${n <= rating ? 'fill-accent text-accent' : 'text-fg-subtle'}`}
              aria-hidden="true"
            />
          ))}
        </div>
      ) : null}
      {notes ? <div className="text-xs italic text-fg-subtle">“{notes}”</div> : null}
    </div>
  );
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}min`;
}

function repsRange(reps: number[]): string {
  if (!reps.length) return '';
  const min = Math.min(...reps);
  const max = Math.max(...reps);
  return min === max ? String(min) : `${min}-${max}`;
}

// Crea una rutina custom a partir de los entrenos de un día: agrupa por ejercicio
// (sets = nº de series, reps = rango observado) y los coloca en el día de hoy.
function buildTemplateFromWorkouts(dayWorkouts: WorkoutWithSets[], name: string): Routine {
  const map = new Map<string, number[]>();
  for (const wo of dayWorkouts) {
    for (const s of wo.sets) {
      const exName = s.exercise?.name?.trim();
      if (!exName) continue;
      const arr = map.get(exName) ?? [];
      arr.push(s.reps);
      map.set(exName, arr);
    }
  }
  const exercises: RoutineExercise[] = [...map].map(([exName, reps]) => ({
    name: exName,
    sets: reps.length,
    reps: repsRange(reps),
  }));
  const mkRest = () => ({ name: 'Descanso', exercises: [] as RoutineExercise[] });
  const days: Routine['days'] = {
    monday: mkRest(),
    tuesday: mkRest(),
    wednesday: mkRest(),
    thursday: mkRest(),
    friday: mkRest(),
    saturday: mkRest(),
    sunday: mkRest(),
  };
  const today = (
    ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as DayOfWeek[]
  )[new Date().getDay()];
  days[today] = { name, exercises };
  return {
    id: `custom-${Date.now()}`,
    name,
    description: '',
    isCustom: true,
    createdAt: new Date().toISOString(),
    days,
  };
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
              className="w-12 rounded-lg text-sm font-mono tabular-nums px-2 py-1.5 text-center outline-none bg-surface-2 border border-line text-fg"
            />
            <span className="text-xs text-fg-subtle">×</span>
            <input
              type="text"
              inputMode="decimal"
              value={row.weight}
              onChange={(e) => update(row.id, 'weight', e.target.value.replace(/[^\d.,]/g, ''))}
              aria-label={`${t('workout.weight')} ${i + 1}`}
              className="w-16 rounded-lg text-sm font-mono tabular-nums px-2 py-1.5 text-center outline-none bg-surface-2 border border-line text-fg"
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { repeatWorkout } = useWorkoutStore();
  const { addRoutine, saveToDb: saveRoutinesToDb } = useRoutineStore();
  const {
    sessions: cardioSessions,
    deleteSession: deleteCardioSession,
    syncFromRemote: syncCardio,
  } = useCardioStore();
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
    const date = new Date(wo.started_at ?? '').toLocaleDateString();
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

  const exportToExcel = async () => {
    const csv = buildExportCsv(filteredSets);
    const fileName = `gymlog_${new Date().toISOString().split('T')[0]}.csv`;

    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: csv,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        const uriResult = await Filesystem.getUri({
          directory: Directory.Cache,
          path: fileName,
        });
        await Share.share({
          title: t('history.export_share_title'),
          url: uriResult.uri,
          dialogTitle: t('history.export_share_dialog'),
        });
      } catch (e) {
        devError('Error export native', e);
        toast.error(t('history.export_error'));
      }
    } else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
    }
  };

  const saveBlob = async (fileName: string, data: string, mime: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: fileName,
          data,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        const uriResult = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
        await Share.share({
          title: t('history.export_share_title'),
          url: uriResult.uri,
          dialogTitle: t('history.export_share_dialog'),
        });
      } catch (err) {
        devError('Error export native', err);
        toast.error(t('history.export_error'));
      }
    } else {
      const blob = new Blob([data], { type: mime });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
    }
  };

  const exportToJson = async () => {
    const fileName = `gymlog_${new Date().toISOString().split('T')[0]}.json`;
    await saveBlob(
      fileName,
      buildExportJson(workouts, cardioSessions),
      'application/json;charset=utf-8;',
    );
  };

  const importFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) {
      toast.error(t('history.select_file_login'));
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse((event.target?.result as string) || '{}');
        const importedWorkouts = Array.isArray(parsed?.workouts) ? parsed.workouts : null;
        if (!importedWorkouts) {
          toast.error(t('history.import_json_invalid'));
          return;
        }

        toast.info(t('history.loading_data'));
        const exerciseList = await fetchExercises(user.id);
        const resolveExerciseId = async (name: string): Promise<string | null> => {
          const clean = (name || '').trim();
          if (clean.length < 2) return null;
          const existing = exerciseList.find(
            (ex) => ex?.name?.toLowerCase() === clean.toLowerCase(),
          );
          if (existing?.id) return existing.id;
          const { data: newEx, error } = await supabase
            .from('exercises')
            .insert({ name: clean, user_id: user.id, muscle_group: 'Otro' })
            .select('id, name')
            .single();
          if (error || !newEx) return null;
          exerciseList.push({
            id: newEx.id,
            name: clean,
            muscle_group: 'Otro',
            muscle_detail: null,
            equipment: 'Gimnasio',
            movement: null,
            is_bilateral: true,
            is_compound: false,
            is_public: false,
            description: null,
            media_url: null,
            user_id: user.id,
            created_at: '',
          });
          return newEx.id;
        };

        let imported = 0;
        for (const w of importedWorkouts) {
          const sets = Array.isArray(w?.sets) ? w.sets : [];
          // Agrupa sets por ejercicio: la RPC guarda un ejercicio por llamada.
          const byExercise = new Map<string, typeof sets>();
          for (const s of sets) {
            const exName = String(s?.exercise ?? '').trim();
            if (!exName) continue;
            const group = byExercise.get(exName) ?? [];
            group.push(s);
            byExercise.set(exName, group);
          }
          const startedAt = w?.started_at || new Date().toISOString();
          const finishedAt = w?.finished_at || startedAt;

          for (const [exName, exSets] of byExercise) {
            const exerciseId = await resolveExerciseId(exName);
            if (!exerciseId) continue;
            const setsPayload = exSets
              .map((s: Record<string, unknown>, i: number) => ({
                set_num: Number(s.set_num) || i + 1,
                reps: Number(s.reps) || 0,
                weight: Number(s.weight) || 0,
                is_warmup: !!s.is_warmup,
                notes: typeof s.notes === 'string' ? s.notes : '',
                rpe: s.rpe != null ? String(s.rpe) : '',
              }))
              .filter((s: { reps: number }) => s.reps > 0);
            if (!setsPayload.length) continue;
            const { error } = await supabase.rpc('save_workout_with_sets', {
              p_user_id: user.id,
              p_exercise_id: exerciseId,
              p_started_at: startedAt,
              p_finished_at: finishedAt,
              p_sets: setsPayload,
            });
            if (!error) imported += 1;
          }
        }

        refetchSets();
        refetchWorkouts();
        queryClient.invalidateQueries({ queryKey: ['workoutsAndSets'], refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ['personalRecords'], refetchType: 'all' });
        toast.success(t('history.import_success', { count: imported }));
      } catch (err) {
        devError('Error import JSON', err);
        toast.error(t('history.import_error'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const importFromCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) {
      toast.error(t('history.select_file_login'));
      return;
    }

    const validExtensions = ['.csv', '.txt'];
    const fileName = file.name.toLowerCase();
    if (!validExtensions.some((ext) => fileName.endsWith(ext))) {
      toast.error(t('history.invalid_format'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;

        if (!text || text.trim().length === 0) {
          toast.error(t('history.file_empty'));
          return;
        }

        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

        if (lines.length < 2) {
          toast.error(t('history.file_insufficient'));
          return;
        }

        toast.info(t('history.loading_data'));
        const exerciseList = await fetchExercises(user.id);

        const getExerciseId = async (name: string): Promise<string | null> => {
          const cleanName = name.replace(/["']/g, '').trim();
          if (!cleanName || cleanName.length < 2) return null;

          const existing = exerciseList.find(
            (ex) => ex && ex.name && ex.name.toLowerCase() === cleanName.toLowerCase(),
          );

          if (existing?.id) return existing.id;

          try {
            const { data: newEx, error } = await supabase
              .from('exercises')
              .insert({
                name: cleanName,
                user_id: user.id,
                muscle_group: 'Otro',
              })
              .select('id')
              .single();

            if (error || !newEx) return null;

            exerciseList.push({
              id: newEx.id,
              name: cleanName,
              muscle_group: 'Otro',
              muscle_detail: null,
              equipment: 'Gimnasio',
              movement: null,
              is_bilateral: true,
              is_compound: false,
              is_public: false,
              description: null,
              media_url: null,
              user_id: user.id,
              created_at: '',
            });
            return newEx.id;
          } catch {
            return null;
          }
        };

        let imported = 0;
        const errors: string[] = [];
        const dateWorkoutMap: Record<string, string> = {};
        const exerciseSetCounts: Record<string, number> = {};
        let currentDate = new Date().toISOString().split('T')[0];

        for (let i = 0; i < lines.length; i++) {
          const lineNum = i + 1;
          const line = lines[i];

          if (line.length > 1000) continue;

          const cols = tokenizeCsvLine(line);
          while (cols.length < 5) cols.push('');

          const firstCol = cols[0].replace(/^"|"$/g, '').trim();
          const secondCol = cols[1]?.replace(/^"|"$/g, '').trim() || '';
          const thirdCol = cols[2]?.replace(/^"|"$/g, '').trim() || '';
          const fourthCol = cols[3]?.replace(/^"|"$/g, '').trim() || '';

          if (firstCol.toLowerCase() === 'fecha') {
            continue;
          }

          const dateFromSecondOrThird = parseDate(secondCol) || parseDate(thirdCol);
          if (isHeaderLine(firstCol) && dateFromSecondOrThird) {
            currentDate = dateFromSecondOrThird;
            continue;
          }

          if (!firstCol || firstCol.length < 2) continue;

          const skipPhrases = [
            'no hay registros',
            'sin registros',
            'sin datos',
            'descanso',
            'libre',
          ];
          if (
            skipPhrases.some(
              (p) => secondCol.toLowerCase().includes(p) || firstCol.toLowerCase().includes(p),
            )
          )
            continue;

          const dateFromFirstCol = parseDate(firstCol);

          let parsedDate = currentDate;
          let exerciseName = '';
          let reps = 10;
          let weight = 0;
          const setNum = 1;
          const isNewFormat = false;

          if (dateFromFirstCol && cols.length >= 4) {
            parsedDate = dateFromFirstCol;
            currentDate = parsedDate;
            exerciseName = secondCol;
            reps = parseNumber(thirdCol) || 10;
            weight = parseNumber(fourthCol) || 0;
          } else {
            exerciseName = firstCol;
            weight = parseNumber(secondCol) || parseNumber(thirdCol) || 0;
            reps = parseNumber(thirdCol) || parseNumber(fourthCol) || 10;
          }

          if (weight === null || weight === 0) continue;

          if (!dateWorkoutMap[parsedDate]) {
            const { data: workoutData, error: woError } = await supabase
              .from('workouts')
              .insert({ user_id: user.id, started_at: parsedDate })
              .select('id')
              .single();

            if (woError || !workoutData) {
              errors.push(`Fila ${lineNum}: Error creando entrenamiento`);
              continue;
            }

            dateWorkoutMap[parsedDate] = workoutData.id;
          }

          const exerciseId = await getExerciseId(exerciseName);

          if (!exerciseId) {
            errors.push(`Fila ${lineNum}: "${exerciseName}" no se pudo crear`);
            continue;
          }

          let finalSetNum = setNum;
          if (!isNewFormat) {
            const key = `${parsedDate}_${exerciseId}`;
            exerciseSetCounts[key] = (exerciseSetCounts[key] || 0) + 1;
            finalSetNum = exerciseSetCounts[key];
          }

          const { error: insertError } = await supabase.from('workout_sets').insert({
            workout_id: dateWorkoutMap[parsedDate],
            exercise_id: exerciseId,
            weight: weight,
            reps: reps,
            set_num: finalSetNum,
          });

          if (insertError) continue;

          imported++;
        }

        if (imported > 0) {
          await refetchSets();
          await refetchWorkouts();
        }

        let message =
          imported > 0
            ? t('history.import_success', { count: imported })
            : t('history.import_none');

        if (errors.length > 0)
          message += ` ${t('history.import_skipped', { count: errors.length })}`;

        if (imported > 0) toast.success(message);
        else toast.error(message);
      } catch (err) {
        devError('Import error:', err);
        toast.error(t('history.import_unexpected'));
      }
    };

    reader.onerror = () => {
      toast.error(t('history.read_file_error'));
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  // Timeline unificado: fuerza + cardio mezclados por fecha
  type TimelineItem =
    | { kind: 'workout'; data: WorkoutWithSets; date: Date }
    | { kind: 'cardio'; data: (typeof cardioSessions)[0]; date: Date };

  const timelineItems: TimelineItem[] = [
    ...workouts.map(
      (wo): TimelineItem => ({ kind: 'workout', data: wo, date: new Date(wo.started_at ?? '') }),
    ),
    ...cardioSessions.map(
      (s): TimelineItem => ({ kind: 'cardio', data: s, date: new Date(s.startedAt) }),
    ),
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
            <div className="skeleton h-10 w-36 rounded-lg" />
            <div className="skeleton h-10 w-24 rounded-lg" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
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
          className="flex p-1 rounded-pill bg-surface border border-line"
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
                className={`relative flex-1 py-2.5 text-xs font-semibold rounded-pill transition-colors ${
                  active ? 'text-accent-fg' : 'text-fg-muted active:text-fg'
                }`}
              >
                {active && (
                  <m.div
                    layoutId="historyViewPill"
                    className="absolute inset-0 rounded-pill bg-accent shadow-btn-accent"
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
            onClick={() => navigate('/user-stats')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] bg-accent/10 border border-line-accent text-accent"
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
                className="flex-1 min-w-[10rem] bg-surface border border-line-strong rounded-lg text-fg text-base p-2 outline-none"
              />
              <select
                value={filterExercise}
                onChange={(e) => setFilterExercise(e.target.value)}
                className="bg-surface border border-line-strong rounded-lg text-fg-muted text-base p-2 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <option value="">{t('history.filter_all')}</option>
                {exercises.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex}
                  </option>
                ))}
              </select>
              <button
                onClick={exportToExcel}
                className="bg-surface border border-line-strong rounded-lg text-accent text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {t('history.export_btn')}
              </button>
              <button
                onClick={exportToJson}
                className="bg-surface border border-line-strong rounded-lg text-accent text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {t('history.export_json')}
              </button>
              <label className="bg-surface border border-line-strong rounded-lg text-fg-muted text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]">
                {t('history.import_btn')}
                <input type="file" accept=".csv,.txt" onChange={importFromCsv} className="hidden" />
              </label>
              <label className="bg-surface border border-line-strong rounded-lg text-fg-muted text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]">
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
                      onClick={() =>
                        handleSaveTemplate(
                          group.items
                            .filter((it) => it.kind === 'workout')
                            .map((it) => it.data as WorkoutWithSets),
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
                    item.kind === 'cardio' ? (
                      <div
                        key={item.data.id}
                        className="rounded-2xl p-3.5 flex items-center justify-between bg-surface border border-line shadow-card transition-transform active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-error/10 text-error">
                            <CardioTypeIcon type={item.data.type} className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-fg">
                                {CARDIO_LABELS[item.data.type]}
                              </span>
                              <span className="text-2xs px-1.5 py-0.5 rounded-pill font-bold bg-error/10 text-error">
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
                          onClick={() => void deleteCardioSession(item.data.id, user?.id ?? null)}
                          className="p-2 rounded-lg ml-2 flex-shrink-0 text-fg-subtle"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        key={item.data.id}
                        className="rounded-2xl overflow-hidden bg-surface border border-line shadow-card"
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
                              <span className="text-2xs px-1.5 py-0.5 rounded-pill font-bold bg-accent/10 text-accent border border-line-accent">
                                Fuerza
                              </span>
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={() => setEditWorkout(item.data)}
                                className="flex items-center gap-1 text-xs font-semibold text-fg-muted"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                {t('history.edit')}
                              </button>
                              <button
                                onClick={() => handleRepeat(item.data)}
                                className="flex items-center gap-1 text-xs font-semibold text-accent"
                              >
                                <Repeat className="w-3.5 h-3.5" />
                                {t('history.repeat')}
                              </button>
                              <button
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
                                    date: new Date(item.data.started_at ?? '').toLocaleDateString(),
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
                                className="px-2 py-1 rounded-pill text-xs bg-surface-2 border border-line text-fg-muted"
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
                <div className="p-4 flex items-center justify-between bg-surface border border-line rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-surface-2">
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
                    onClick={() => void deleteCardioSession(session.id, user?.id ?? null)}
                    className="p-2 rounded-lg ml-2 flex-shrink-0 text-fg-subtle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </SwipeToDelete>
            ))
          )}
        </div>
      ) : view === 'sets' ? (
        <div className="rounded-2xl overflow-hidden bg-surface border border-line-strong shadow-card">
          {loadingSets ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton h-10 rounded-lg" />
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
                  ? new Date(s.workout.started_at).toLocaleDateString()
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
                className="rounded-2xl overflow-hidden bg-surface border border-line-strong shadow-card"
              >
                {/* Cabecera fecha/volumen */}
                <div className="px-3 py-2 flex justify-between items-center bg-surface-2 border-b border-line">
                  <span className="text-2xs font-bold uppercase tracking-[0.12em] text-fg-subtle">
                    {group.date}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-fg-subtle">
                      {group.totalSets} series · {(group.totalVolume / 1000).toFixed(1)}t
                    </span>
                    <button
                      onClick={() => handleSaveTemplate(group.workouts, group.date)}
                      className="flex items-center gap-1 text-xs font-semibold text-accent"
                      title={t('history.save_as_template')}
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
                          onClick={() => setEditWorkout(wo)}
                          className="flex items-center gap-1 text-xs font-semibold text-fg-muted"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          {t('history.edit')}
                        </button>
                        <button
                          onClick={() => handleRepeat(wo)}
                          className="flex items-center gap-1 text-xs font-semibold text-accent"
                        >
                          <Repeat className="w-3.5 h-3.5" />
                          {t('history.repeat')}
                        </button>
                        <button
                          onClick={async () => {
                            const uniqueExercises = [
                              ...new Set(wo.sets.map((s) => s.exercise?.name)),
                            ].length;
                            const volume = wo.sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
                            const success = await shareWorkoutImage({
                              exerciseCount: uniqueExercises,
                              totalSets: wo.sets.length,
                              totalVolume: volume,
                              date: new Date(wo.started_at ?? '').toLocaleDateString(),
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
                          className="px-2 py-1 rounded-pill text-xs bg-surface-2 border border-line text-fg-muted"
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
