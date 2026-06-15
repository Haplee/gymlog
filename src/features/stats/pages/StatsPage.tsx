import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useCardioStore, CARDIO_LABELS } from '@features/cardio/stores/cardioStore';
import { Layout } from '@app/components/Layout';
import { subWeeks, startOfWeek, eachWeekOfInterval, subDays } from 'date-fns';
import {
  fetchWorkoutsAndSets,
  fetchPersonalRecords,
  fetchExerciseGoals,
  upsertExerciseGoal,
  deleteExerciseGoal,
} from '@shared/api/queries';
import { calcular1RM } from '@shared/lib/brzycki';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { KPICard } from '../components/KPICards';
import { CardioTypeIcon } from '@shared/components/CardioIcons';
import type { ChartView } from '../components/Charts';

// recharts es pesado: cargarlo bajo demanda saca ~100kb del chunk inicial de la página
const MuscleGroupChart = lazy(() =>
  import('../components/Charts').then((mod) => ({ default: mod.MuscleGroupChart })),
);
const VolumeChart = lazy(() =>
  import('../components/Charts').then((mod) => ({ default: mod.VolumeChart })),
);
const ProgressionChart = lazy(() =>
  import('../components/Charts').then((mod) => ({ default: mod.ProgressionChart })),
);

function ChartFallback() {
  return <div className="h-56 skeleton rounded-2xl" aria-hidden="true" />;
}
import {
  calculateCurrentStreak,
  calculateMaxStreak,
  calculateWeeklyVolume,
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
import { FatigueAnalysis } from '../components/FatigueAnalysis';
import { CHART_COLORS } from '../constants';
import { toast } from 'sonner';
import { m } from 'framer-motion';
import { TrendingUp, Target, Calculator, ChevronDown, AlertTriangle } from 'lucide-react';
import { devError } from '@shared/lib/devtools';

type PeriodFilter = '4semanas' | '3meses' | '6meses' | '1año';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  '4semanas': '4 sem',
  '3meses': '3 mes',
  '6meses': '6 mes',
  '1año': '1 año',
};

const PERIOD_WEEKS: Record<PeriodFilter, number> = {
  '4semanas': 4,
  '3meses': 12,
  '6meses': 24,
  '1año': 52,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span className="text-2xs font-bold uppercase tracking-[0.12em] text-fg-subtle">
        {children}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
    </div>
  );
}

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function calculateMuscleGroupDistribution(
  sets: {
    weight: number;
    reps: number;
    is_warmup?: boolean | null;
    exercise?: { muscle_group?: string | null } | null;
  }[],
) {
  const distribution: Record<string, number> = {};
  sets
    .filter((s) => !s.is_warmup)
    .forEach((s) => {
      const muscleGroup = s.exercise?.muscle_group || 'Otro';
      const volume = s.weight * s.reps;
      distribution[muscleGroup] = (distribution[muscleGroup] || 0) + volume;
    });
  return Object.entries(distribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function StatsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { sessions: cardioSessions, syncFromRemote: syncCardio } = useCardioStore();

  useEffect(() => {
    if (user?.id) void syncCardio(user.id);
  }, [user?.id, syncCardio]);

  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('4semanas');
  const [metricFilter, setMetricFilter] = useState<'1rm' | 'maxWeight' | 'volume'>('1rm');
  const [chartView, setChartView] = useState<ChartView>('bar');
  const [showProgression, setShowProgression] = useState(true);
  const [rmWeight, setRmWeight] = useState('');
  const [rmReps, setRmReps] = useState('');
  const [rmResult, setRmResult] = useState<number | null>(null);
  const [goalInput, setGoalInput] = useState('');

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
      toast.error('Error al cargar las estadísticas');
    }
  }, [error]);

  const workouts = useMemo(() => data?.workouts ?? [], [data?.workouts]);
  const recentSets = useMemo(() => data?.sets ?? [], [data?.sets]);

  const currentStreak = useMemo(() => calculateCurrentStreak(workouts), [workouts]);
  const maxStreak = useMemo(() => calculateMaxStreak(workouts), [workouts]);
  const weeklyVolume = useMemo(() => calculateWeeklyVolume(recentSets), [recentSets]);
  const prevWeekVolume = useMemo(() => calculatePreviousWeekVolume(recentSets), [recentSets]);
  const volumeChange = useMemo(
    () => calculateVolumeChangePercent(weeklyVolume, prevWeekVolume),
    [weeklyVolume, prevWeekVolume],
  );
  const sessionCount = useMemo(() => calculateSessionCountLast30Days(workouts), [workouts]);
  const daysSinceLast = useMemo(() => getDaysSinceLastWorkout(workouts), [workouts]);
  const avgDuration = useMemo(() => calculateAverageSessionDuration(workouts), [workouts]);
  const totalPRs = useMemo(() => calculateAllTimePRsCount(personalRecords), [personalRecords]);
  const muscleRecovery = useMemo(() => analyzeMuscleRecovery(recentSets), [recentSets]);
  const suggestedGroup = useMemo(() => getSuggestedMuscleGroup(muscleRecovery), [muscleRecovery]);
  const muscleGroupDistribution = useMemo(
    () => calculateMuscleGroupDistribution(recentSets),
    [recentSets],
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
    const target = parseFloat(goalInput.replace(',', '.'));
    if (!user || !activeExerciseId || !Number.isFinite(target) || target <= 0) return;
    try {
      await upsertExerciseGoal(user.id, activeExerciseId, target);
      setGoalInput('');
      await refetchGoals();
      toast.success('Objetivo guardado');
    } catch {
      toast.error('No se pudo guardar el objetivo');
    }
  };

  const handleClearGoal = async () => {
    if (!user || !activeExerciseId) return;
    try {
      await deleteExerciseGoal(user.id, activeExerciseId);
      await refetchGoals();
    } catch {
      toast.error('No se pudo quitar el objetivo');
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

  const calcRM = (weight: string, reps: string) => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (w && r) setRmResult(calcular1RM(w, r));
    else setRmResult(null);
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  const periodButtons: PeriodFilter[] = ['4semanas', '3meses', '6meses', '1año'];
  const metricButtons: ('1rm' | 'maxWeight' | 'volume')[] = ['1rm', 'maxWeight', 'volume'];

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
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5">
        {/* ── Entrenamiento ── */}
        <section className="space-y-3">
          <SectionLabel>Entrenamiento</SectionLabel>

          <m.div
            className="grid grid-cols-2 gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <KPICard
              title="Racha actual"
              value={currentStreak}
              subtitle="días seguidos"
              icon="flame"
              isNewPR={currentStreak >= 7}
            />
            <KPICard
              title="Volumen semanal"
              value={`${(weeklyVolume / 1000).toFixed(1)}t`}
              subtitle="esta semana"
              icon="volume"
              trend={volumeChange}
            />
            <KPICard
              title="Frecuencia"
              value={sessionCount}
              subtitle="sesiones (30 días)"
              icon="frequency"
            />
            <KPICard
              title="Duración media"
              value={`${avgDuration}m`}
              subtitle="por sesión"
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
              title="Volumen total"
              value={`${(allTimeVolume / 1000).toFixed(1)}t`}
              subtitle="histórico"
              icon="all-volume"
            />
            <KPICard
              title="Mejor 1RM"
              value={bestOneRm > 0 ? `${bestOneRm}kg` : '—'}
              subtitle="estimado"
              icon="best-1rm"
            />
            <KPICard title="Notas" value={setNotesCount} subtitle="series anotadas" icon="notes" />
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
                    Racha máxima
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
                  className="font-mono font-bold leading-none"
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
                  className="font-mono font-bold leading-none"
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

        {/* ── Cardio ── */}
        {cardioStats.totalSessions > 0 && (
          <section className="space-y-3">
            <SectionLabel>Cardio</SectionLabel>

            <m.div
              className="grid grid-cols-2 gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <KPICard
                title="Sesiones semana"
                value={cardioStats.sessionsThisWeek}
                subtitle="esta semana"
                icon="cardio-sessions"
              />
              <KPICard
                title="Tiempo cardio"
                value={formatSeconds(cardioStats.totalTimeWeek)}
                subtitle="esta semana"
                icon="cardio-time"
              />
              {cardioStats.totalDistWeek > 0 && (
                <KPICard
                  title="Distancia"
                  value={`${cardioStats.totalDistWeek.toFixed(1)}km`}
                  subtitle="esta semana"
                  icon="cardio-dist"
                />
              )}
              <KPICard
                title="Total sesiones"
                value={cardioStats.totalSessions}
                subtitle="historial"
                icon="cardio-sessions"
                accentColor="#38bdf8"
              />
            </m.div>

            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="grid grid-cols-3 gap-3"
            >
              <KPICard
                title="Tiempo total"
                value={formatSeconds(cardioStats.totalTimeAll)}
                subtitle="histórico"
                icon="cardio-time"
              />
              <KPICard
                title="Distancia total"
                value={
                  cardioStats.totalDistAll > 0 ? `${cardioStats.totalDistAll.toFixed(1)}km` : '—'
                }
                subtitle="histórico"
                icon="cardio-dist"
              />
              <KPICard
                title="Duración media"
                value={cardioStats.avgDur > 0 ? formatSeconds(cardioStats.avgDur) : '—'}
                subtitle="por sesión"
                icon="duration"
              />
            </m.div>

            {/* Cardio type breakdown */}
            {cardioTypeBreakdown.length > 0 && (
              <m.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="rounded-card p-4 bg-surface"
              >
                <div className="flex items-center gap-2 mb-3">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4"
                    fill="none"
                    stroke="var(--interactive-primary)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 13c2-2.5 4-2.5 6 0 2 2.5 4 2.5 6 0 2-2.5 4-2.5 6 0" />
                    <path d="M2 17.5c2-2.5 4-2.5 6 0 2 2.5 4 2.5 6 0 2-2.5 4-2.5 6 0" />
                  </svg>
                  <span className="text-sm font-medium text-fg-muted">Actividades cardio</span>
                </div>
                <div className="space-y-2.5">
                  {cardioTypeBreakdown.map(({ type, duration, label }, i) => {
                    const maxDur = cardioTypeBreakdown[0].duration;
                    const pct = Math.round((duration / maxDur) * 100);
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-fg-subtle">
                              <CardioTypeIcon
                                type={type as Parameters<typeof CardioTypeIcon>[0]['type']}
                                className="w-3.5 h-3.5"
                              />
                            </span>
                            <span className="text-sm text-fg-muted">{label}</span>
                          </div>
                          <span className="text-xs font-mono font-medium text-fg">
                            {formatSeconds(duration)}
                          </span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden bg-surface-2">
                          <m.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </m.div>
            )}
          </section>
        )}

        {/* ── Volumen semanal ── */}
        <section className="space-y-3">
          <SectionLabel>Análisis</SectionLabel>

          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="rounded-card p-4 bg-surface"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-fg-muted">Volumen semanal</span>
              </div>
              <div className="flex gap-1">
                {periodButtons.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodFilter(p)}
                    className="text-[0.5625rem] px-2 py-1 rounded-pill transition-colors font-medium"
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
                {(weeklyVolumeData.reduce((s, d) => s + d.vol, 0) / 1000).toFixed(1)}t
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
                <span className="text-sm font-medium text-fg-muted">Distribución muscular</span>
              </div>
              <Suspense fallback={<ChartFallback />}>
                <MuscleGroupChart data={muscleGroupDistribution} />
              </Suspense>
            </m.div>
          )}

          {/* Progresión por ejercicio */}
          {uniqueExercises.length > 0 && (
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26 }}
              className="rounded-card p-4 bg-surface"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4"
                    fill="none"
                    stroke="var(--interactive-primary)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 4v6a6 6 0 0 0 12 0V4" />
                    <line x1="4" y1="20" x2="20" y2="20" />
                  </svg>
                  <span className="text-sm font-semibold text-fg">Progresión</span>
                </div>
                <button
                  onClick={() => setShowProgression(!showProgression)}
                  className="flex items-center gap-1 text-xs text-fg-subtle"
                >
                  <span>{showProgression ? 'Ocultar' : 'Mostrar'}</span>
                  <ChevronDown
                    className="w-4 h-4 transition-transform"
                    style={{ transform: showProgression ? 'rotate(180deg)' : 'none' }}
                  />
                </button>
              </div>

              {showProgression && (
                <div className="space-y-3">
                  <select
                    value={selectedExercise}
                    onChange={(e) => setSelectedExercise(e.target.value)}
                    className="w-full rounded-xl text-sm p-3 bg-surface-2 border border-line-strong text-fg"
                  >
                    {uniqueExercises.map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-1">
                    {metricButtons.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMetricFilter(m)}
                        className="flex-1 text-xs py-2 rounded-xl transition-colors font-medium"
                        style={
                          metricFilter === m
                            ? {
                                backgroundColor: 'var(--interactive-primary)',
                                color: 'var(--interactive-primary-fg)',
                              }
                            : {
                                backgroundColor: 'var(--bg-surface-2)',
                                color: 'var(--text-tertiary)',
                              }
                        }
                      >
                        {m === '1rm' ? '1RM' : m === 'maxWeight' ? 'Peso máx' : 'Volumen'}
                      </button>
                    ))}
                  </div>

                  <Suspense fallback={<ChartFallback />}>
                    <ProgressionChart
                      data={progressionData}
                      metric={metricFilter}
                      exerciseName={activeExercise}
                    />
                  </Suspense>

                  {progressionData.length >= 2 && (
                    <div className="pt-2 flex items-center justify-between text-xs border-t border-line">
                      <span className="text-fg-subtle">Mejor registro</span>
                      <span className="font-semibold text-accent">
                        {progressionData[progressionData.length - 1]?.value.toFixed(1)} kg
                      </span>
                    </div>
                  )}

                  {activeExerciseId && (
                    <div className="pt-3 border-t border-line">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-fg">Objetivo 1RM</span>
                        {activeGoal != null && (
                          <span className="text-2xs font-mono tabular-nums text-fg-subtle">
                            {currentBest1rm} / {activeGoal} kg
                          </span>
                        )}
                      </div>
                      {activeGoal != null ? (
                        <>
                          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full"
                              style={{
                                width: `${Math.min(100, Math.round((currentBest1rm / activeGoal) * 100))}%`,
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-2xs text-fg-subtle">
                              {currentBest1rm >= activeGoal
                                ? '¡Objetivo alcanzado! 🎉'
                                : `Faltan ${(activeGoal - currentBest1rm).toFixed(1)} kg`}
                            </span>
                            <button
                              onClick={handleClearGoal}
                              className="text-2xs text-fg-subtle underline"
                            >
                              Quitar
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={goalInput}
                            onChange={(e) => setGoalInput(e.target.value.replace(/[^\d.,]/g, ''))}
                            placeholder={`p.ej. ${currentBest1rm + 5} kg`}
                            className="flex-1 rounded-lg text-sm px-3 py-2 outline-none bg-surface-2 border border-line text-fg"
                          />
                          <button
                            onClick={handleSaveGoal}
                            disabled={!goalInput}
                            className="px-4 rounded-lg text-sm font-semibold bg-accent text-accent-fg disabled:opacity-50"
                          >
                            Fijar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </m.div>
          )}
        </section>

        {/* ── Recuperación ── */}
        <FatigueAnalysis
          muscleGroups={muscleRecovery}
          daysSinceLastWorkout={daysSinceLast}
          suggestedGroup={suggestedGroup}
        />

        {/* ── Calculadora 1RM ── */}
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-card p-4 bg-surface"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-4 h-4 text-accent" />
            <span className="text-base font-semibold text-fg">Calculadora 1RM</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-1.5 text-fg-subtle">Peso (kg)</div>
              <input
                type="number"
                placeholder="100"
                value={rmWeight}
                onChange={(e) => {
                  setRmWeight(e.target.value);
                  calcRM(e.target.value, rmReps);
                }}
                className="w-full rounded-xl text-base p-3 outline-none bg-surface-2 border border-line-strong text-fg"
              />
            </div>
            <div>
              <div className="text-xs mb-1.5 text-fg-subtle">Reps</div>
              <input
                type="number"
                placeholder="10"
                value={rmReps}
                onChange={(e) => {
                  setRmReps(e.target.value);
                  calcRM(rmWeight, e.target.value);
                }}
                className="w-full rounded-xl text-base p-3 outline-none bg-surface-2 border border-line-strong text-fg"
              />
            </div>
          </div>
          <div className="mt-4 text-center">
            <div className="text-xs mb-1 text-fg-subtle">1RM estimado</div>
            <div className="text-3xl font-bold font-mono text-accent">
              {rmResult ? `${rmResult.toFixed(1)} kg` : '—'}
            </div>
          </div>
        </m.div>
      </div>
    </Layout>
  );
}
