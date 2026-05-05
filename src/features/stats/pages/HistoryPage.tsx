import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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
import { ChevronRight, Trash2, Repeat, Share2 } from 'lucide-react';

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
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }} className="last:border-b-0">
      <div
        onClick={() => setExpanded(!expanded)}
        className="px-3 py-3 flex justify-between items-center cursor-pointer transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--interactive-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <div className="flex items-center gap-3">
          <ChevronRight
            className="w-4 h-4 flex-shrink-0 transition-transform"
            style={{
              color: 'var(--text-tertiary)',
              transform: expanded ? 'rotate(90deg)' : 'none',
            }}
          />
          <span className="text-[0.9375rem] font-medium" style={{ color: 'var(--text-primary)' }}>
            {exercise}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[0.5625rem] px-1.5 py-0.5 rounded-[var(--radius-pill)] font-bold"
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
            className="p-1.5 rounded-[var(--radius-sm)] transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,69,58,0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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
              className="flex justify-between items-center px-3 py-2 rounded-[var(--radius-md)] ml-7"
              style={{
                backgroundColor: 'var(--bg-surface-2)',
                border: '1px solid var(--border-glass)',
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-[0.75rem] font-mono"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('workout.sets')} {s.set_num}
                </span>
                <span className="text-[0.875rem]" style={{ color: 'var(--text-secondary)' }}>
                  {s.reps} {t('workout.reps').toLowerCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="font-semibold text-[0.875rem]"
                  style={{ color: 'var(--interactive-primary)' }}
                >
                  {s.weight} kg
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s.id);
                  }}
                  className="p-1 rounded"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
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
  const { user } = useAuthStore();
  const { repeatWorkout } = useWorkoutStore();
  const { sessions: cardioSessions, deleteSession: deleteCardioSession } = useCardioStore();
  const [view, setView] = useState<'sets' | 'workouts' | 'cardio'>('sets');
  const [filterExercise, setFilterExercise] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    data: workouts = [],
    isLoading: loadingWorkouts,
    refetch: refetchWorkouts,
  } = useQuery({
    queryKey: ['workouts', user?.id],
    queryFn: () => fetchWorkouts(user!.id),
    enabled: !!user?.id,
  });

  const {
    data: recentSets = [],
    isLoading: loadingSets,
    refetch: refetchSets,
  } = useQuery({
    queryKey: ['recentSets', user?.id],
    queryFn: () => fetchRecentSets(user!.id),
    enabled: !!user?.id,
  });

  const loading = loadingWorkouts || loadingSets;

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

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
    if (user) refetchSets();
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
        console.error('Error export native', e);
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
        console.error('Import error:', err);
        toast.error('Error inesperado al importar datos');
      }
    };

    reader.onerror = () => {
      toast.error('Error al leer el archivo desde tu dispositivo');
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  if (loading) {
    return (
      <Layout>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-xl)] overflow-hidden">
          <div className="skeleton h-12 w-full"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex gap-2 mb-3 flex-wrap">
        <select
          value={view}
          onChange={(e) => setView(e.target.value as 'sets' | 'workouts' | 'cardio')}
          className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-secondary)] text-[0.95rem] p-2 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <option value="sets">{t('history.sets_view')}</option>
          <option value="workouts">{t('history.workouts_view')}</option>
          <option value="cardio">Cardio</option>
        </select>

        {view === 'sets' && (
          <>
            <select
              value={filterExercise}
              onChange={(e) => setFilterExercise(e.target.value)}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-secondary)] text-[0.95rem] p-2 cursor-pointer transition-all hover:scale-[1.02]"
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
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--interactive-primary)] text-[0.95rem] px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('history.export_btn')}
            </button>
            <label className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-secondary)] text-[0.95rem] px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]">
              {t('history.import_btn')}
              <input type="file" accept=".csv,.txt" onChange={importFromCsv} className="hidden" />
            </label>
          </>
        )}
      </div>

      {view === 'cardio' ? (
        <div className="space-y-2">
          {cardioSessions.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Sin sesiones de cardio registradas
            </div>
          ) : (
            cardioSessions.map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-[var(--radius-lg)] p-4 flex items-center justify-between"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--bg-surface-2)' }}
                  >
                    <span style={{ color: 'var(--interactive-primary)' }}>
                      <CardioTypeIcon type={session.type} className="w-4.5 h-4.5" />
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {CARDIO_LABELS[session.type]}
                      </span>
                      <span
                        className="font-mono text-sm font-semibold"
                        style={{ color: 'var(--interactive-primary)' }}
                      >
                        {formatDuration(session.duration)}
                      </span>
                    </div>
                    <div
                      className="text-[0.6875rem] flex items-center gap-2"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
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
                      <div
                        className="text-[0.6875rem] italic mt-0.5"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {session.notes}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteCardioSession(session.id)}
                  className="p-2 rounded-lg ml-2 flex-shrink-0"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))
          )}
        </div>
      ) : view === 'sets' ? (
        <div
          className="rounded-[var(--radius-lg)] overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
          }}
        >
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
                <div className="divide-y divide-[var(--border-subtle)]">
                  {sortedDates.map((date) => (
                    <div key={date}>
                      {/* Cabecera de fecha — mismo estilo que group headers del ExerciseSelector */}
                      <div
                        className="px-3 py-2 flex items-center gap-1.5 sticky top-0 z-10"
                        style={{
                          backgroundColor: 'var(--bg-surface-2)',
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        <span
                          className="text-[0.625rem] font-bold uppercase tracking-[0.12em]"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
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
              <motion.div
                key={gi}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.04 }}
                className="rounded-[var(--radius-lg)] overflow-hidden"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                }}
              >
                {/* Cabecera fecha/volumen */}
                <div
                  className="px-3 py-2 flex justify-between items-center"
                  style={{
                    backgroundColor: 'var(--bg-surface-2)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <span
                    className="text-[0.625rem] font-bold uppercase tracking-[0.12em]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {group.date}
                  </span>
                  <span
                    className="text-[0.6875rem] font-mono"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {group.totalSets} series · {(group.totalVolume / 1000).toFixed(1)}t
                  </span>
                </div>
                {group.workouts.map((wo) => (
                  <div
                    key={wo.id}
                    className="px-3 py-2.5"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[0.8125rem]" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(wo.started_at ?? '').toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleRepeat(wo)}
                          className="flex items-center gap-1 text-[0.75rem] font-semibold"
                          style={{ color: 'var(--interactive-primary)' }}
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
                          className="flex items-center gap-1 text-[0.75rem] font-semibold"
                          style={{ color: 'var(--text-secondary)' }}
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
                          className="px-2 py-1 rounded-[var(--radius-pill)] text-[0.75rem]"
                          style={{
                            backgroundColor: 'var(--bg-surface-2)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-glass)',
                          }}
                        >
                          {s.exercise?.name}: {s.reps}×{s.weight}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            ))
          )}
        </div>
      )}

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={t('history.delete_confirm')}
        icon={<Trash2 className="w-5 h-5" style={{ color: 'var(--error)' }} />}
        variant="danger"
      >
        <p className="text-[var(--text-secondary)] mb-6">Esta acción no se puede deshacer.</p>
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
