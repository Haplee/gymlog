import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { m } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { useCardioStore, CARDIO_LABELS } from '@features/cardio/stores/cardioStore';
import { Layout } from '@app/components/Layout';
import { supabase } from '@shared/lib/supabase';
import { shareWorkout } from '@shared/lib/share';
import type { WorkoutWithSets, WorkoutSetWithDetails } from '@shared/lib/types';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { fetchWorkouts, fetchRecentSets, fetchExercises } from '@shared/api/queries';
import { EmptyHistory } from '@shared/components/EmptyStates';
import { Modal, Button } from '@shared/components/ui';
import { CardioTypeIcon } from '@shared/components/CardioIcons';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight, Trash2, Repeat, Share2, BarChart2 } from 'lucide-react';
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
          <span
            className="text-[0.5625rem] px-1.5 py-0.5 rounded-pill font-bold"
            style={{
              backgroundColor: 'rgba(200,255,0,0.08)',
              color: 'var(--interactive-primary)',
              border: '1px solid rgba(200,255,0,0.15)',
            }}
          >
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
              className="flex flex-col gap-1 px-3 py-2 rounded-xl ml-7 bg-surface-2 border border-line-glass"
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
                    <span
                      className="text-[0.5625rem] px-1.5 py-0.5 rounded-pill font-bold uppercase"
                      style={{
                        backgroundColor: 'rgba(245,158,11,0.12)',
                        color: 'var(--warning)',
                      }}
                    >
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
                  <span className="font-semibold text-sm text-accent">{s.weight} kg</span>
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

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}min`;
}

export function HistoryPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { repeatWorkout } = useWorkoutStore();
  const {
    sessions: cardioSessions,
    deleteSession: deleteCardioSession,
    syncFromRemote: syncCardio,
  } = useCardioStore();
  const [view, setView] = useState<'all' | 'sets' | 'workouts' | 'cardio'>('all');
  const [filterExercise, setFilterExercise] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    enabled: !!user?.id,
  });

  const loading = loadingWorkouts || loadingSets;

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    void syncCardio(user.id);
  }, [user, navigate, syncCardio]);

  const handleRepeat = (workout: WorkoutWithSets) => {
    repeatWorkout(workout);
    navigate('/');
  };

  const exercises = [...new Set(recentSets.map((s) => s.exercise?.name).filter(Boolean))];

  const filteredSets = recentSets
    .filter((s) => !filterExercise || s.exercise?.name === filterExercise)
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
      queryClient.invalidateQueries({ queryKey: ['lastExerciseSets'] });
      queryClient.invalidateQueries({ queryKey: ['personalRecords'] });
      queryClient.invalidateQueries({ queryKey: ['workoutsAndSets'] });
    }
    setDeleteId(null);
  };

  const exportToExcel = async () => {
    const BOM = '\uFEFF';
    let csv = BOM + 'Fecha,Ejercicio,Repeticiones,Peso\n';

    filteredSets.forEach((s: WorkoutSetWithDetails) => {
      const exName = s.exercise?.name || 'Desconocido';
      const safeName = exName.replace(/"/g, '""');
      const dateFormatted = s.workout?.started_at ? s.workout.started_at.split('T')[0] : '';
      csv += `${dateFormatted},"${safeName}",${s.reps ?? 0},${s.weight ?? 0}\n`;
    });

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
          title: 'Exportar Historial',
          url: uriResult.uri,
          dialogTitle: 'Compartir Historial',
        });
      } catch (e) {
        devError('Error export native', e);
        toast.error('Error al exportar histórico');
      }
    } else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
    }
  };

  const importFromCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) {
      toast.error('Selecciona un archivo e inicia sesión');
      return;
    }

    const validExtensions = ['.csv', '.txt'];
    const fileName = file.name.toLowerCase();
    if (!validExtensions.some((ext) => fileName.endsWith(ext))) {
      toast.error('Formato no válido');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;

        if (!text || text.trim().length === 0) {
          toast.error('El archivo está vacío');
          return;
        }

        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

        if (lines.length < 2) {
          toast.error('El archivo no tiene suficientes datos');
          return;
        }

        toast.info('Cargando datos...');
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
              user_id: user.id,
              created_at: '',
            });
            return newEx.id;
          } catch {
            return null;
          }
        };

        const parseNumber = (val: string | undefined): number | null => {
          if (!val) return null;
          let cleaned = val.replace(/["']/g, '').trim().toLowerCase();
          if (cleaned === '' || cleaned === '-' || cleaned === 'no' || cleaned === 'n/a')
            return null;
          cleaned = cleaned
            .replace(/[a-z]/g, ' ')
            .replace(/[^\d,.-]/g, ' ')
            .replace(/,/g, '.')
            .replace(/\s+/g, ' ')
            .trim();
          const num = parseFloat(cleaned);
          return !isNaN(num) && num > 0 && num < 2000 ? Math.round(num * 10) / 10 : null;
        };

        const parseDate = (dateStr: string): string | null => {
          if (!dateStr || dateStr.trim() === '') return null;
          const cleaned = dateStr.trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
          const formats = [
            { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, day: 1, month: 2, year: 3 },
            { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, day: 1, month: 2, year: 3 },
            { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, day: 1, month: 2, year: 3 },
          ];
          for (const fmt of formats) {
            const match = cleaned.match(fmt.regex);
            if (match) {
              let year = parseInt(match[fmt.year], 10);
              const month = parseInt(match[fmt.month], 10);
              const day = parseInt(match[fmt.day], 10);
              if (year < 100) year += 2000;
              if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              }
            }
          }
          return null;
        };

        const isHeaderLine = (firstCol: string): boolean => {
          const lower = firstCol.toLowerCase();
          const headers = [
            'tren superior',
            'tren inferior',
            'pecho',
            'espalda',
            'hombro',
            'multiarticulares',
            'isquio',
            'femoral',
            'abductores',
            'adductores',
            'cuádriceps',
            'gemelos',
            'tibiales',
            'bíceps',
            'tríceps',
            'piernas',
            'brazo',
            'espalda baja',
            'glúteos',
            'core',
            'abdomen',
          ];
          return headers.some((h) => lower.includes(h));
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

          const cols: string[] = [];
          let inQuotes = false;
          let current = '';

          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              cols.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          cols.push(current.trim());

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

        let message = imported > 0 ? `Importados: ${imported}` : 'No se pudieron importar datos';

        if (errors.length > 0) message += ` (${errors.length} errores obvios saltados)`;

        if (imported > 0) toast.success(message);
        else toast.error(message);
      } catch (err) {
        devError('Import error:', err);
        toast.error('Error inesperado al importar datos');
      }
    };

    reader.onerror = () => {
      toast.error('Error al leer el archivo desde tu dispositivo');
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
      {/* Barra de filtros sticky con tratamiento glass */}
      <div className="sticky top-0 z-20 py-2 -mt-2 mb-3 space-y-2 bg-base/90 backdrop-blur-md">
        {/* Segmented control de vista — píldora deslizante */}
        <div
          role="tablist"
          aria-label="Vista del historial"
          className="flex p-1 rounded-pill bg-surface border border-line"
        >
          {(
            [
              { id: 'all', label: 'Todo' },
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
            Mis estadísticas
          </button>

          {view === 'sets' && (
            <>
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
              <label className="bg-surface border border-line-strong rounded-lg text-fg-muted text-base px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]">
                {t('history.import_btn')}
                <input type="file" accept=".csv,.txt" onChange={importFromCsv} className="hidden" />
              </label>
            </>
          )}
        </div>
      </div>

      {view === 'all' ? (
        <div className="space-y-4">
          {timelineByDate.length === 0 ? (
            <EmptyHistory />
          ) : (
            timelineByDate.map((group) => (
              <div key={group.date}>
                <div className="px-1 mb-2">
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-fg-subtle">
                    {group.date}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.items.map((item, i) =>
                    item.kind === 'cardio' ? (
                      <m.div
                        key={item.data.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="rounded-2xl p-3.5 flex items-center justify-between bg-surface border border-line shadow-card transition-transform active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}
                          >
                            <span style={{ color: '#ef4444' }}>
                              <CardioTypeIcon type={item.data.type} className="w-4.5 h-4.5" />
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-fg">
                                {CARDIO_LABELS[item.data.type]}
                              </span>
                              <span
                                className="text-xs px-1.5 py-0.5 rounded-pill font-bold"
                                style={{
                                  backgroundColor: 'rgba(239,68,68,0.1)',
                                  color: '#ef4444',
                                }}
                              >
                                Cardio
                              </span>
                            </div>
                            <div className="text-xs flex items-center gap-2 mt-0.5 text-fg-muted">
                              <span className="font-mono font-semibold">
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
                      </m.div>
                    ) : (
                      <m.div
                        key={item.data.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
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
                              <span
                                className="text-xs px-1.5 py-0.5 rounded-pill font-bold"
                                style={{
                                  backgroundColor: 'rgba(200,255,0,0.08)',
                                  color: 'var(--interactive-primary)',
                                  border: '1px solid rgba(200,255,0,0.15)',
                                }}
                              >
                                Fuerza
                              </span>
                            </div>
                            <div className="flex gap-3">
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
                                  const success = await shareWorkout({
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
                                className="px-2 py-1 rounded-pill text-xs bg-surface-2 border border-line-glass text-fg-muted"
                              >
                                {s.exercise?.name}: {s.reps}×{s.weight}
                              </span>
                            ))}
                          </div>
                        </div>
                      </m.div>
                    ),
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : view === 'cardio' ? (
        <div className="space-y-2">
          {cardioSessions.length === 0 ? (
            <div className="text-center py-12 text-sm text-fg-subtle">
              Sin sesiones de cardio registradas
            </div>
          ) : (
            cardioSessions.map((session, i) => (
              <m.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-2xl p-4 flex items-center justify-between bg-surface border border-line"
              >
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
              </m.div>
            ))
          )}
        </div>
      ) : view === 'sets' ? (
        <div className="rounded-2xl overflow-hidden bg-surface border border-line-strong shadow-card">
          {filteredSets.length === 0 ? (
            <EmptyHistory />
          ) : (
            (() => {
              const grouped: Record<string, Record<string, typeof filteredSets>> = {};
              filteredSets.forEach((s: WorkoutSetWithDetails) => {
                const date = s.workout?.started_at
                  ? new Date(s.workout.started_at).toLocaleDateString()
                  : 'Sin fecha';
                const exercise = s.exercise?.name || 'Desconocido';
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
            <EmptyHistory />
          ) : (
            groupedWorkouts.map((group, gi) => (
              <m.div
                key={gi}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.04 }}
                className="rounded-2xl overflow-hidden bg-surface border border-line-strong shadow-card"
              >
                {/* Cabecera fecha/volumen */}
                <div className="px-3 py-2 flex justify-between items-center bg-surface-2 border-b border-line">
                  <span className="text-2xs font-bold uppercase tracking-[0.12em] text-fg-subtle">
                    {group.date}
                  </span>
                  <span className="text-xs font-mono text-fg-subtle">
                    {group.totalSets} series · {(group.totalVolume / 1000).toFixed(1)}t
                  </span>
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
                            const success = await shareWorkout({
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
                          className="px-2 py-1 rounded-pill text-xs bg-surface-2 border border-line-glass text-fg-muted"
                        >
                          {s.exercise?.name}: {s.reps}×{s.weight}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </m.div>
            ))
          )}
        </div>
      )}

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={t('history.delete_confirm')}
        icon={<Trash2 className="w-5 h-5 text-error" />}
        variant="danger"
      >
        <p className="text-fg-muted mb-6">Esta acción no se puede deshacer.</p>
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
