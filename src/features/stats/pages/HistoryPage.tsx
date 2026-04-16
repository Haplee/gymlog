import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { Layout } from '@app/components/Layout';
import { supabase } from '@shared/lib/supabase';
import { shareWorkout } from '@shared/lib/share';
import type { WorkoutWithSets, WorkoutSetWithDetails } from '@shared/lib/types';
import { toast } from 'sonner';
import { fetchWorkouts, fetchRecentSets, fetchExercises } from '@shared/api/queries';
import { EmptyHistory } from '@shared/components/EmptyStates';
import { Modal, Button } from '@shared/components/ui';
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
  const [expanded, setExpanded] = useState(false);
  const sortedSets = [...sets].sort((a, b) => a.set_num - b.set_num);
  const firstSet = sortedSets[0];

  return (
    <div className="border-b border-[var(--border-subtle)] last:border-b-0">
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-3 flex justify-between items-center cursor-pointer hover:bg-[var(--interactive-hover)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <ChevronRight
            className="w-4 h-4 text-[var(--text-tertiary)]"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          />
          <span className="font-medium text-[var(--text-primary)]">{exercise}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--interactive-primary)] font-medium text-[0.8125rem]">
            {sortedSets.length} series
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(firstSet.id);
            }}
            className="bg-transparent border-none cursor-pointer transition-all hover:scale-125 ml-2"
          >
            <Trash2 className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {sortedSets.map((s) => (
            <div
              key={s.id}
              className="flex justify-between items-center bg-[var(--bg-surface-2)] p-2 rounded-[var(--radius-md)] ml-6"
            >
              <div className="flex items-center gap-3">
                <span className="text-[var(--text-tertiary)] text-[0.8125rem]">
                  Serie {s.set_num}
                </span>
                <span className="text-[var(--text-secondary)] text-[0.875rem]">{s.reps} reps</span>
              </div>
              <span className="text-[var(--interactive-primary)] font-medium">{s.weight} kg</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { repeatWorkout } = useWorkoutStore();
  const [view, setView] = useState<'sets' | 'workouts'>('sets');
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
    )
    .slice(0, 1000);

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

  const exportToExcel = () => {
    let csv = 'Fecha,Ejercicio,Serie,Repeticiones,Peso (kg)\n';

    filteredSets.forEach((s: WorkoutSetWithDetails) => {
      const exName = s.exercise?.name
        ? `"${s.exercise.name.replace(/"/g, '""')}"`
        : '"Desconocido"';
      let dateFormatted = '';
      if (s.workout?.started_at) {
        const splitted = s.workout.started_at.split('T')[0];
        const parts = splitted.split('-');
        if (parts.length === 3) {
          dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          dateFormatted = splitted;
        }
      }

      csv += `${dateFormatted},${exName},${s.set_num},${s.reps},${s.weight}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gymlog_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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

          let cleaned = val.replace(/["']/g, '').trim();
          if (cleaned === '' || cleaned === '-' || cleaned.toLowerCase() === 'no') return null;

          cleaned = cleaned
            .replace(/\s+/g, ' ')
            .replace(/[a-zA-Z]/g, ' ')
            .replace(/[^\d,.-]/g, '')
            .replace(/,/g, '.');

          const match = cleaned.match(/^(\d+\.?\d*)/);
          if (!match) return null;

          const num = parseFloat(match[1]);
          return !isNaN(num) && num > 0 && num < 1000 ? Math.round(num * 10) / 10 : null;
        };

        const parseDate = (dateStr: string): string | null => {
          if (!dateStr || dateStr.trim() === '') return null;

          if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3 && parts[0].length === 4) return dateStr.trim();
          }

          if (!dateStr.includes('/')) return null;

          const parts = dateStr.split('/');
          if (parts.length !== 3) return null;

          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);

          if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

          const fullYear = year < 100 ? 2000 + year : year;
          const finalYear = fullYear > 2026 ? fullYear - 100 : fullYear;

          if (day < 1 || day > 31 || month < 1 || month > 12) return null;

          return `${finalYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
          const fifthCol = cols[4]?.replace(/^"|"$/g, '').trim() || '';

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
          let setNum = 1;
          let isNewFormat = false;

          if (dateFromFirstCol && cols.length >= 3) {
            parsedDate = dateFromFirstCol;
            currentDate = parsedDate;
            exerciseName = secondCol;
            setNum = parseNumber(thirdCol) || 1;
            reps = parseNumber(fourthCol) || 10;
            weight = parseNumber(fifthCol) || 0;
            isNewFormat = true;
          } else {
            exerciseName = firstCol;
            weight = parseNumber(secondCol) || parseNumber(thirdCol) || 0;
            reps = 10;
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
        <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
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
          onChange={(e) => setView(e.target.value as 'sets' | 'workouts')}
          className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] text-[0.95rem] p-2 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <option value="sets">Series</option>
          <option value="workouts">Entrenos</option>
        </select>

        {view === 'sets' && (
          <>
            <select
              value={filterExercise}
              onChange={(e) => setFilterExercise(e.target.value)}
              className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] text-[0.95rem] p-2 cursor-pointer transition-all hover:scale-[1.02]"
            >
              <option value="">Todos</option>
              {exercises.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
            <button
              onClick={exportToExcel}
              className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-lg text-[#c8ff00] text-[0.95rem] px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Exportar
            </button>
            <label className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] text-[0.95rem] px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]">
              Importar
              <input type="file" accept=".csv,.txt" onChange={importFromCsv} className="hidden" />
            </label>
          </>
        )}
      </div>

      {view === 'sets' ? (
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] overflow-hidden">
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
                      <div className="bg-[var(--bg-surface)] p-3 text-[0.6875rem] font-semibold text-[var(--text-tertiary)] uppercase border-b border-[var(--border-subtle)]">
                        {date}
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
        <div className="space-y-3">
          {groupedWorkouts.length === 0 ? (
            <EmptyHistory />
          ) : (
            groupedWorkouts.map((group, gi) => (
              <motion.div
                key={gi}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.05 }}
                className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] overflow-hidden"
              >
                <div className="p-3 border-b border-[var(--border-subtle)] flex justify-between items-center">
                  <span className="font-medium text-[var(--text-primary)]">{group.date}</span>
                  <span className="text-[var(--text-tertiary)] text-[0.8125rem]">
                    {group.totalSets} series · {group.totalVolume.toLocaleString()} kg
                  </span>
                </div>
                {group.workouts.map((wo) => (
                  <div
                    key={wo.id}
                    className="p-3 border-b border-[var(--border-subtle)] last:border-b-0"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[var(--text-secondary)] text-[0.875rem]">
                        {new Date(wo.started_at ?? '').toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRepeat(wo)}
                          className="text-[var(--interactive-primary)] text-[0.8rem] font-medium bg-transparent border-none cursor-pointer transition-all hover:scale-105"
                        >
                          <Repeat className="w-3.5 h-3.5 mr-1" />
                          Repetir
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
                            if (success) toast.success('Workout compartido');
                            else toast.error('Error al compartir');
                          }}
                          className="text-[var(--text-secondary)] text-[0.8rem] font-medium bg-transparent border-none cursor-pointer transition-all hover:scale-105"
                        >
                          <Share2 className="w-3.5 h-3.5 mr-1" />
                          Compartir
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {wo.sets.map((s: WorkoutSetWithDetails, si) => (
                        <span
                          key={si}
                          className="bg-[var(--bg-surface-2)] px-2 py-1 rounded-[var(--radius-pill)] text-[0.8rem] text-[var(--text-secondary)]"
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

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="¿Eliminar registro?">
        <p className="text-[var(--text-secondary)] mb-6">Esta acción no se puede deshacer.</p>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}
