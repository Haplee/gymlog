import {
  calculateMuscleGroupDistribution,
  PERIOD_LABELS,
  PERIOD_WEEKS,
  type PeriodFilter,
} from '@features/stats/utils/statsData';
import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useCardioStore, CARDIO_LABELS } from '@features/cardio/stores/cardioStore';
import { Layout } from '@app/components/Layout';
import { subWeeks, startOfWeek, eachWeekOfInterval, subDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  fetchWorkoutsAndSets,
  fetchPersonalRecords,
  fetchExerciseGoals,
  upsertExerciseGoal,
  deleteExerciseGoal,
} from '@shared/api/queries';
import { calcular1RM } from '@shared/lib/brzycki';
import { Skeleton } from '@shared/components/ui';
import { KPICard } from '../components/KPICards';
import { CardioStatsSection } from '../components/CardioStatsSection';
import { OneRmCalculator } from '../components/OneRmCalculator';
import { ExerciseComparison } from '../components/ExerciseComparison';
import { ProgressionSection } from '../components/ProgressionSection';
import type { ChartView } from '../components/Charts';

// recharts es pesado: cargarlo bajo demanda saca ~100kb del chunk inicial de la página
const MuscleGroupChart = lazy(() =>
  import('../components/Charts').then((mod) => ({ default: mod.MuscleGroupChart })),
);
const VolumeChart = lazy(() =>
  import('../components/Charts').then((mod) => ({ default: mod.VolumeChart })),
);

function ChartFallback() {
  return <div className="h-56 skeleton rounded-card" aria-hidden="true" />;
}
import {
  calculateCurrentStreak,
  calculateMaxStreak,
  calculateWeeklyVolume,
  calculateDailyVolumeThisWeek,
  calculatePreviousWeekVolume,
  calculateSessionCountLast30Days,
  calculateVolumeChangePercent,
  calculateAverageSessionDuration,
  calculateAllTimePRsCount,
} from '../utils/kpiCalculations';
import { buildProgressionData } from '../utils/progressionMetrics';
import {
  analyzeMuscleRecovery,
  getSuggestedMuscleGroup,
  getDaysSinceLastWorkout,
} from '../utils/fatigueAnalysis';
import { useExerciseMusclesMap } from '../hooks/useExerciseMusclesMap';
import { useWeight } from '@shared/hooks/useWeight';
import { FatigueAnalysis } from '../components/FatigueAnalysis';
import { toast } from 'sonner';
import { m } from 'framer-motion';
import { TrendingUp, Target, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { devError } from '@shared/lib/devtools';

/** Iniciales de lunes a domingo para la tira de volumen semanal. */
const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

/** Mismo rótulo que SectionHeader: titular en acento, sin versalitas ni regla. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-base font-bold text-accent px-1">{children}</h2>;
}

export function StatsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const cardioSessions = useCardioStore((s) => s.sessions);
  const syncCardio = useCardioStore((s) => s.syncFromRemote);

  useEffect(() => {
    if (user?.id) void syncCardio(user.id);
  }, [user?.id, syncCardio]);

  // Rango de la semana en curso, como el «12–18 JUL 2026» de la maqueta.
  const weekRangeLabel = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sameMonth = monday.getMonth() === sunday.getMonth();
    const left = sameMonth
      ? format(monday, 'd', { locale: es })
      : format(monday, 'd MMM', { locale: es });
    return `${left}–${format(sunday, 'd MMM yyyy', { locale: es })}`;
  }, []);

  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('4semanas');
  const [metricFilter, setMetricFilter] = useState<'1rm' | 'maxWeight' | 'volume'>('1rm');
  const [chartView, setChartView] = useState<ChartView>('bar');
  const [showProgression, setShowProgression] = useState(true);
  const [goalInput, setGoalInput] = useState('');
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['workoutsAndSets', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('No user');
      const result = await fetchWorkoutsAndSets(user.id);
      if (!result) return { workouts: [], sets: [] };
      return result;
    },
    enabled: !!user?.id,
    retry: 1,
  });

  const { data: personalRecords = [] } = useQuery({
    queryKey: ['personalRecords', user?.id],
    queryFn: () => fetchPersonalRecords(user?.id ?? ''),
    enabled: !!user?.id,
  });

  const { data: exerciseGoals = [], refetch: refetchGoals } = useQuery({
    queryKey: ['exerciseGoals', user?.id],
    queryFn: () => fetchExerciseGoals(user?.id ?? ''),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (error) {
      devError('Error fetching stats data:', error);
      toast.error(t('stats.load_error'));
    }
  }, [error, t]);

  const workouts = useMemo(() => data?.workouts ?? [], [data?.workouts]);
  const recentSets = useMemo(() => data?.sets ?? [], [data?.sets]);

  const currentStreak = useMemo(() => calculateCurrentStreak(workouts), [workouts]);
  const maxStreak = useMemo(() => calculateMaxStreak(workouts), [workouts]);
  const weeklyVolume = useMemo(() => calculateWeeklyVolume(recentSets), [recentSets]);
  const dailyVolume = useMemo(() => calculateDailyVolumeThisWeek(recentSets), [recentSets]);
  const maxDailyVolume = useMemo(() => Math.max(...dailyVolume, 1), [dailyVolume]);
  const todayIndex = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }, []);
  const prevWeekVolume = useMemo(() => calculatePreviousWeekVolume(recentSets), [recentSets]);
  const volumeChange = useMemo(
    () => calculateVolumeChangePercent(weeklyVolume, prevWeekVolume),
    [weeklyVolume, prevWeekVolume],
  );
  const sessionCount = useMemo(() => calculateSessionCountLast30Days(workouts), [workouts]);
  const daysSinceLast = useMemo(() => getDaysSinceLastWorkout(workouts), [workouts]);
  const avgDuration = useMemo(() => calculateAverageSessionDuration(workouts), [workouts]);
  const totalPRs = useMemo(() => calculateAllTimePRsCount(personalRecords), [personalRecords]);
  const musclesMap = useExerciseMusclesMap();
  // Volúmenes en la unidad del usuario (kg→t, lb→k lb), no toneladas fijas.
  const { formatVol, format: formatKg, toKg } = useWeight();
  const muscleRecovery = useMemo(
    () => analyzeMuscleRecovery(recentSets, musclesMap),
    [recentSets, musclesMap],
  );
  const suggestedGroup = useMemo(() => getSuggestedMuscleGroup(muscleRecovery), [muscleRecovery]);
  const muscleGroupDistribution = useMemo(
    () => calculateMuscleGroupDistribution(recentSets, musclesMap),
    [recentSets, musclesMap],
  );
  const uniqueExercises = useMemo(() => {
    return [...new Set(recentSets.map((s) => s.exercise?.name).filter(Boolean))] as string[];
  }, [recentSets]);

  // Estancamiento: ejercicios entrenados en las últimas 2 semanas cuyo PR no
  // mejora desde hace ≥5 semanas. Señal para variar carga/volumen.
  const stagnantExercises = useMemo(() => {
    const now = new Date().getTime();
    const week = 7 * 24 * 60 * 60 * 1000;
    const nameById = new Map<string, string>();
    const trainedRecently = new Set<string>();
    for (const s of recentSets) {
      if (s.exercise_id && s.exercise?.name) nameById.set(s.exercise_id, s.exercise.name);
      const d = new Date(s.workout?.started_at ?? 0).getTime();
      if (s.exercise_id && now - d < 2 * week) trainedRecently.add(s.exercise_id);
    }
    return personalRecords
      .filter((pr) => {
        if (!pr.exercise_id || !trainedRecently.has(pr.exercise_id) || !pr.achieved_at)
          return false;
        return now - new Date(pr.achieved_at).getTime() > 5 * week;
      })
      .map((pr) => ({
        id: pr.exercise_id as string,
        name: nameById.get(pr.exercise_id as string) ?? 'Ejercicio',
        weeks: Math.floor((now - new Date(pr.achieved_at as string).getTime()) / week),
      }))
      .sort((a, b) => b.weeks - a.weeks)
      .slice(0, 4);
  }, [recentSets, personalRecords]);

  const activeExercise = selectedExercise || uniqueExercises[0] || '';

  // Objetivo 1RM del ejercicio activo: id, mejor marca actual y meta fijada.
  const activeExerciseId = useMemo(
    () => recentSets.find((s) => s.exercise?.name === activeExercise)?.exercise_id ?? null,
    [recentSets, activeExercise],
  );
  const currentBest1rm = useMemo(() => {
    let best = 0;
    for (const s of recentSets) {
      if (s.exercise?.name !== activeExercise) continue;
      if ((s as { is_warmup?: boolean | null }).is_warmup) continue;
      const e = calcular1RM(s.weight, s.reps);
      if (e > best) best = e;
    }
    return Math.round(best);
  }, [recentSets, activeExercise]);
  const activeGoal = useMemo(
    () => exerciseGoals.find((g) => g.exercise_id === activeExerciseId)?.target_one_rm ?? null,
    [exerciseGoals, activeExerciseId],
  );

  const handleSaveGoal = async () => {
    // El usuario teclea en su unidad; la BD guarda siempre kg.
    const typed = parseFloat(goalInput.replace(',', '.'));
    const target = toKg(typed);
    if (!user || !activeExerciseId || !Number.isFinite(target) || target <= 0) return;
    try {
      await upsertExerciseGoal(user.id, activeExerciseId, target);
      setGoalInput('');
      await refetchGoals();
      toast.success('Objetivo guardado');
    } catch {
      toast.error(t('stats.goal_save_error'));
    }
  };

  const handleClearGoal = async () => {
    if (!user || !activeExerciseId) return;
    try {
      await deleteExerciseGoal(user.id, activeExerciseId);
      await refetchGoals();
    } catch {
      toast.error(t('stats.goal_remove_error'));
    }
  };

  const weeklyVolumeData = useMemo(() => {
    const weeks = PERIOD_WEEKS[periodFilter];
    const now = new Date();
    const start = subWeeks(now, weeks);
    const weekStarts = eachWeekOfInterval({ start, end: now }).map((w) =>
      startOfWeek(w, { weekStartsOn: 1 }),
    );
    return weekStarts
      .map((weekStart, i) => {
        const weekEnd = subDays(weekStart, -7);
        const vol = recentSets
          .filter((s) => !(s as { is_warmup?: boolean | null }).is_warmup)
          .filter((s) => {
            const dateStr = s.workout?.started_at ?? '';
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d >= weekStart && d < weekEnd;
          })
          .reduce((sum, s) => sum + s.reps * s.weight, 0);
        return { week: `S${i + 1}`, vol };
      })
      .reverse();
  }, [recentSets, periodFilter]);

  const progressionData = useMemo(() => {
    return buildProgressionData(recentSets, activeExercise, metricFilter);
  }, [recentSets, activeExercise, metricFilter]);

  // Comparador: mejor 1RM estimado por día para dos ejercicios, alineado por fecha.
  const cmpA = compareA || uniqueExercises[0] || '';
  const cmpB = compareB || uniqueExercises[1] || '';
  const comparisonData = useMemo(() => {
    if (!cmpA || !cmpB || cmpA === cmpB) return [];
    const byDateA = new Map<string, number>();
    const byDateB = new Map<string, number>();
    for (const s of recentSets) {
      if ((s as { is_warmup?: boolean | null }).is_warmup) continue;
      const name = s.exercise?.name;
      const dateStr = s.workout?.started_at;
      if (!name || !dateStr) continue;
      const day = dateStr.slice(0, 10);
      const e = calcular1RM(s.weight, s.reps);
      if (name === cmpA) byDateA.set(day, Math.max(byDateA.get(day) ?? 0, e));
      if (name === cmpB) byDateB.set(day, Math.max(byDateB.get(day) ?? 0, e));
    }
    const days = [...new Set([...byDateA.keys(), ...byDateB.keys()])].sort();
    return days.map((day) => ({
      date: day,
      a: byDateA.has(day) ? Math.round(byDateA.get(day) as number) : null,
      b: byDateB.has(day) ? Math.round(byDateB.get(day) as number) : null,
    }));
  }, [recentSets, cmpA, cmpB]);

  // Cardio stats
  const cardioStats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekSessions = cardioSessions.filter((s) => new Date(s.startedAt) >= weekStart);
    const totalTimeWeek = weekSessions.reduce((sum, s) => sum + s.duration, 0);
    const totalDistWeek = weekSessions.reduce((sum, s) => sum + (s.distance ?? 0), 0);
    const totalDistAll = cardioSessions.reduce((sum, s) => sum + (s.distance ?? 0), 0);
    const totalTimeAll = cardioSessions.reduce((sum, s) => sum + s.duration, 0);
    const totalCalAll = cardioSessions.reduce((sum, s) => sum + (s.calories ?? 0), 0);
    const avgDur = cardioSessions.length ? Math.round(totalTimeAll / cardioSessions.length) : 0;
    return {
      sessionsThisWeek: weekSessions.length,
      totalTimeWeek,
      totalDistWeek,
      totalSessions: cardioSessions.length,
      totalDistAll,
      totalTimeAll,
      totalCalAll,
      avgDur,
    };
  }, [cardioSessions]);

  // Total volume + notes count + best 1RM
  const allTimeVolume = useMemo(
    () =>
      recentSets
        .filter((s) => !(s as { is_warmup?: boolean | null }).is_warmup)
        .reduce((sum, s) => sum + s.reps * s.weight, 0),
    [recentSets],
  );
  const setNotesCount = useMemo(
    () => recentSets.filter((s) => (s as { notes?: string | null }).notes).length,
    [recentSets],
  );
  const bestOneRm = useMemo(() => {
    let best = 0;
    for (const pr of personalRecords) {
      const stored = Number((pr as { one_rm?: number | null }).one_rm) || 0;
      const e1rm = stored > 0 ? stored : calcular1RM(Number(pr.weight) || 0, Number(pr.reps) || 0);
      if (e1rm > best) best = e1rm;
    }
    return Math.round(best);
  }, [personalRecords]);

  // Cardio weekly breakdown by type
  const cardioTypeBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    cardioSessions.forEach((s) => {
      breakdown[s.type] = (breakdown[s.type] || 0) + s.duration;
    });
    return Object.entries(breakdown)
      .map(([type, duration]) => ({
        type,
        duration,
        label: CARDIO_LABELS[type as keyof typeof CARDIO_LABELS] ?? type,
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 4);
  }, [cardioSessions]);

  if (!user) {
    navigate('/login');
    return null;
  }

  const periodButtons: PeriodFilter[] = ['4semanas', '3meses', '6meses', '1año'];

  if (isLoading) {
    return (
      <Layout>
        {/* Replica el layout real: KPIs 2col + charts + heatmap */}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-card" />
            ))}
          </div>
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Cabecera de la referencia visual (`public/screens/stats.png`): titular
          RENDIMIENTO, rango de la semana y los dos números protagonistas.
          Ya no hay botón de volver —/stats es una pestaña, no una subpantalla—
          y las medidas se abren desde el cajón. */}
      <header className="mb-5">
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-fg">
          {t('stats.performance')}
        </h1>
        <div className="label-caps mt-1 text-fg-subtle">{weekRangeLabel}</div>

        <div className="mt-5 flex items-end justify-between gap-4 hairline-separator pb-5">
          <div>
            <div className="label-caps text-fg-subtle">{t('stats.streak_short')}</div>
            <div className="text-display-huge font-display tabular leading-none text-fg">
              {currentStreak}
              <span className="text-accent">d</span>
            </div>
          </div>
          <div className="text-right">
            <div className="label-caps text-fg-subtle">{t('stats.volume_short')}</div>
            <div className="text-display-huge font-display tabular leading-none text-fg">
              {formatVol(weeklyVolume)}
            </div>
          </div>
        </div>
      </header>

      {/* Tira «VOL. SEMANAL»: una barra por día de la semana en curso, hoy en el
          acento. Es lo que dibuja la maqueta; los gráficos con filtros de
          periodo siguen más abajo.

          Sin volumen esta semana no se dibuja: la caja de 112 px se quedaba
          vacía y parecía un fallo de render (visto en el emulador). */}
      {weeklyVolume > 0 && (
        <section className="mb-6">
          <div className="flex items-baseline justify-between gap-3">
            <span className="label-caps text-fg-subtle">{t('stats.weekly_volume_short')}</span>
            <span className="tabular text-base text-fg">{formatKg(weeklyVolume, 0)}</span>
          </div>
          <div className="mt-3 flex items-end gap-2">
            {dailyVolume.map((vol, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <span className="label-caps h-3 text-accent">
                  {i === todayIndex ? t('common.today') : ''}
                </span>
                <div className="flex h-28 w-full items-end">
                  <div
                    className={`w-full rounded-sm ${i === todayIndex ? 'bg-accent' : 'bg-surface-2'}`}
                    // Proporcional al día más cargado, con un mínimo visible para
                    // que un día flojo no desaparezca del todo.
                    style={{
                      height: `${vol > 0 ? Math.max(8, (vol / maxDailyVolume) * 100) : 4}%`,
                    }}
                    aria-hidden="true"
                  />
                </div>
                <span
                  className={`label-caps ${i === todayIndex ? 'text-accent' : 'text-fg-subtle'}`}
                >
                  {WEEKDAY_INITIALS[i]}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-5">
        {/* ── Entrenamiento ── */}
        <section className="space-y-3">
          <SectionLabel>{t('stats.section_training')}</SectionLabel>

          <m.div
            className="grid grid-cols-2 gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Racha y volumen semanal ya son los dos números gigantes de la
                portada: repetirlos aquí como tarjetas sobraba. La variación
                respecto a la semana pasada, que solo estaba en esa tarjeta, se
                conserva junto a la frecuencia. */}
            <KPICard
              title={t('stats.kpi_vs_last_week')}
              value={`${volumeChange > 0 ? '+' : ''}${volumeChange}%`}
              subtitle={t('stats.kpi_volume')}
              icon="volume"
            />
            <KPICard
              title={t('stats.kpi_frequency')}
              value={sessionCount}
              subtitle={t('stats.kpi_sessions_30d')}
              icon="frequency"
            />
            <KPICard
              title={t('stats.kpi_avg_duration')}
              value={`${avgDuration}m`}
              subtitle={t('stats.kpi_per_session')}
              icon="duration"
            />
          </m.div>

          {/* Volumen total + Mejor 1RM + Notas */}
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="grid grid-cols-3 gap-3"
          >
            <KPICard
              size="sm"
              title={t('stats.kpi_total_volume')}
              value={formatVol(allTimeVolume)}
              subtitle={t('stats.kpi_all_time')}
              icon="all-volume"
            />
            <KPICard
              size="sm"
              title={t('stats.kpi_best_1rm')}
              value={bestOneRm > 0 ? formatKg(bestOneRm, 0) : '—'}
              subtitle={t('stats.kpi_estimated')}
              icon="best-1rm"
            />
            <KPICard
              size="sm"
              title={t('stats.kpi_notes')}
              value={setNotesCount}
              subtitle={t('stats.kpi_noted_sets')}
              icon="notes"
            />
          </m.div>

          {/* Racha max + PRs */}
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="grid grid-cols-2 gap-3"
          >
            <div className="relative overflow-hidden rounded-card p-4 bg-surface">
              <div
                className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-card"
                style={{ backgroundColor: 'var(--warning)' }}
              />
              <div className="pl-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                    {t('stats.max_streak')}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4"
                    fill="none"
                    style={{ stroke: 'var(--warning)' }}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                  </svg>
                </div>
                <div
                  className="font-mono font-bold leading-none tabular-nums"
                  style={{ fontSize: '2.25rem', color: 'var(--text-primary)' }}
                >
                  {maxStreak}
                </div>
                <div className="mt-2 text-xs text-fg-subtle">días</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-card p-4 bg-surface">
              <div
                className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-card"
                style={{ backgroundColor: 'var(--interactive-primary)' }}
              />
              <div className="pl-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                    Records personales
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4"
                    fill="none"
                    style={{ stroke: 'var(--interactive-primary)' }}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M8 20l4-4 4 4" />
                    <line x1="12" y1="16" x2="12" y2="20" />
                  </svg>
                </div>
                <div
                  className="font-mono font-bold leading-none tabular-nums"
                  style={{ fontSize: '2.25rem', color: 'var(--interactive-primary)' }}
                >
                  {totalPRs}
                </div>
                <div className="mt-2 text-xs text-fg-subtle">PRs totales</div>
              </div>
            </div>
          </m.div>

          {stagnantExercises.length > 0 && (
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-card p-4 bg-surface border border-line"
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-sm font-semibold text-fg">Posible estancamiento</span>
              </div>
              <div className="space-y-2">
                {stagnantExercises.map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between">
                    <span className="text-sm text-fg-muted truncate pr-2">{ex.name}</span>
                    <span className="text-xs font-mono tabular-nums text-warning flex-shrink-0">
                      {ex.weeks} sem sin PR
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-fg-subtle mt-3">
                Prueba subir peso, cambiar el rango de reps o variar el ejercicio.
              </p>
            </m.div>
          )}
        </section>

        <CardioStatsSection
          stats={cardioStats}
          breakdown={cardioTypeBreakdown}
          Label={SectionLabel}
        />

        {/* ── Volumen semanal ── */}
        <section className="space-y-3">
          <SectionLabel>{t('stats.section_analysis')}</SectionLabel>

          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="rounded-card p-4 bg-surface"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-fg-muted">
                  {t('stats.weekly_volume')}
                </span>
              </div>
              <div className="flex gap-1">
                {periodButtons.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPeriodFilter(p)}
                    className="text-[0.5625rem] px-2 py-1 rounded-sm transition-colors font-medium"
                    style={
                      periodFilter === p
                        ? {
                            backgroundColor: 'var(--interactive-primary)',
                            color: 'var(--interactive-primary-fg)',
                          }
                        : { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-tertiary)' }
                    }
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            <Suspense fallback={<ChartFallback />}>
              <VolumeChart data={weeklyVolumeData} view={chartView} onViewChange={setChartView} />
            </Suspense>
            <div className="mt-3 pt-3 flex items-center justify-between text-xs border-t border-line">
              <span className="text-fg-subtle">Total ({PERIOD_LABELS[periodFilter]})</span>
              <span className="font-semibold text-fg">
                {formatVol(weeklyVolumeData.reduce((s, d) => s + d.vol, 0))}
              </span>
            </div>
          </m.div>

          {/* Distribución muscular */}
          {muscleGroupDistribution.length > 0 && (
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="rounded-card p-4 bg-surface"
            >
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-fg-muted">
                  {t('stats.muscle_distribution')}
                </span>
              </div>
              <Suspense fallback={<ChartFallback />}>
                <MuscleGroupChart data={muscleGroupDistribution} />
              </Suspense>
            </m.div>
          )}

          <ProgressionSection
            exercises={uniqueExercises}
            selectedExercise={selectedExercise}
            onSelectExercise={setSelectedExercise}
            activeExerciseName={activeExercise}
            activeExerciseId={activeExerciseId}
            metric={metricFilter}
            onMetric={setMetricFilter}
            expanded={showProgression}
            onToggle={() => setShowProgression(!showProgression)}
            data={progressionData}
            goal={activeGoal}
            currentBest1rm={currentBest1rm}
            goalInput={goalInput}
            onGoalInput={setGoalInput}
            onSaveGoal={handleSaveGoal}
            onClearGoal={handleClearGoal}
          />

          <ExerciseComparison
            exercises={uniqueExercises}
            a={cmpA}
            b={cmpB}
            onChangeA={setCompareA}
            onChangeB={setCompareB}
            data={comparisonData}
          />
        </section>

        {/* ── Recuperación ── */}
        <FatigueAnalysis
          muscleGroups={muscleRecovery}
          daysSinceLastWorkout={daysSinceLast}
          suggestedGroup={suggestedGroup}
        />

        <OneRmCalculator />
      </div>
    </Layout>
  );
}
