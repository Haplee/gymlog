import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useCardioStore, CARDIO_LABELS } from '@features/cardio/stores/cardioStore';
import { Layout } from '@app/components/Layout';
import { subWeeks, startOfWeek, eachWeekOfInterval, subDays } from 'date-fns';
import { fetchWorkoutsAndSets, fetchPersonalRecords } from '@shared/api/queries';
import { calcular1RM } from '@shared/lib/brzycki';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { KPICard } from '../components/KPICards';
import { CardioTypeIcon } from '@shared/components/CardioIcons';
import {
  MuscleGroupChart,
  VolumeChart,
  ProgressionChart,
  type ChartView,
} from '../components/Charts';
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
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { TrendingUp, Target, Calculator, ChevronDown } from 'lucide-react';
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
      <span
        className="text-[0.6rem] font-bold uppercase tracking-[0.12em]"
        style={{ color: 'var(--text-tertiary)' }}
      >
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

  const activeExercise = selectedExercise || uniqueExercises[0] || '';

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
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
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

          <motion.div
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
          </motion.div>

          {/* Volumen total + Mejor 1RM + Notas */}
          <motion.div
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
          </motion.div>

          {/* Racha max + PRs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="grid grid-cols-2 gap-3"
          >
            <div
              className="relative overflow-hidden rounded-[var(--radius-xl)] p-4"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <div
                className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-[var(--radius-xl)]"
                style={{ backgroundColor: '#fbbf24' }}
              />
              <div className="pl-2">
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-[0.625rem] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Racha máxima
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4"
                    fill="none"
                    stroke="#fbbf24"
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
                <div className="mt-2 text-[0.6875rem]" style={{ color: 'var(--text-tertiary)' }}>
                  días
                </div>
              </div>
            </div>

            <div
              className="relative overflow-hidden rounded-[var(--radius-xl)] p-4"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <div
                className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-[var(--radius-xl)]"
                style={{ backgroundColor: '#c8ff00' }}
              />
              <div className="pl-2">
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-[0.625rem] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Records personales
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4"
                    fill="none"
                    stroke="#c8ff00"
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
                <div className="mt-2 text-[0.6875rem]" style={{ color: 'var(--text-tertiary)' }}>
                  PRs totales
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Cardio ── */}
        {cardioStats.totalSessions > 0 && (
          <section className="space-y-3">
            <SectionLabel>Cardio</SectionLabel>

            <motion.div
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
            </motion.div>

            <motion.div
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
            </motion.div>

            {/* Cardio type breakdown */}
            {cardioTypeBreakdown.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="rounded-[var(--radius-xl)] p-4"
                style={{ backgroundColor: 'var(--bg-surface)' }}
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
                  <span
                    className="text-[0.8125rem] font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Actividades cardio
                  </span>
                </div>
                <div className="space-y-2.5">
                  {cardioTypeBreakdown.map(({ type, duration, label }, i) => {
                    const maxDur = cardioTypeBreakdown[0].duration;
                    const pct = Math.round((duration / maxDur) * 100);
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span style={{ color: 'var(--text-tertiary)' }}>
                              <CardioTypeIcon
                                type={type as Parameters<typeof CardioTypeIcon>[0]['type']}
                                className="w-3.5 h-3.5"
                              />
                            </span>
                            <span
                              className="text-[0.8125rem]"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {label}
                            </span>
                          </div>
                          <span
                            className="text-[0.75rem] font-mono font-medium"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {formatSeconds(duration)}
                          </span>
                        </div>
                        <div
                          className="h-1 rounded-full overflow-hidden"
                          style={{ backgroundColor: 'var(--bg-surface-2)' }}
                        >
                          <motion.div
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
              </motion.div>
            )}
          </section>
        )}

        {/* ── Volumen semanal ── */}
        <section className="space-y-3">
          <SectionLabel>Análisis</SectionLabel>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="rounded-[var(--radius-xl)] p-4"
            style={{ backgroundColor: 'var(--bg-surface)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--interactive-primary)' }} />
                <span
                  className="text-[0.8125rem] font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Volumen semanal
                </span>
              </div>
              <div className="flex gap-1">
                {periodButtons.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodFilter(p)}
                    className="text-[0.5625rem] px-2 py-1 rounded-[var(--radius-pill)] transition-colors font-medium"
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
            <VolumeChart data={weeklyVolumeData} view={chartView} onViewChange={setChartView} />
            <div
              className="mt-3 pt-3 flex items-center justify-between text-[0.75rem]"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              <span style={{ color: 'var(--text-tertiary)' }}>
                Total ({PERIOD_LABELS[periodFilter]})
              </span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {(weeklyVolumeData.reduce((s, d) => s + d.vol, 0) / 1000).toFixed(1)}t
              </span>
            </div>
          </motion.div>

          {/* Distribución muscular */}
          {muscleGroupDistribution.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="rounded-[var(--radius-xl)] p-4"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4" style={{ color: 'var(--interactive-primary)' }} />
                <span
                  className="text-[0.8125rem] font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Distribución muscular
                </span>
              </div>
              <MuscleGroupChart data={muscleGroupDistribution} />
            </motion.div>
          )}

          {/* Progresión por ejercicio */}
          {uniqueExercises.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26 }}
              className="rounded-[var(--radius-xl)] p-4"
              style={{ backgroundColor: 'var(--bg-surface)' }}
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
                  <span
                    className="text-[0.8125rem] font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Progresión
                  </span>
                </div>
                <button
                  onClick={() => setShowProgression(!showProgression)}
                  className="flex items-center gap-1 text-[0.75rem]"
                  style={{ color: 'var(--text-tertiary)' }}
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
                    className="w-full rounded-[var(--radius-md)] text-sm p-3"
                    style={{
                      backgroundColor: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
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
                        className="flex-1 text-[0.6875rem] py-2 rounded-[var(--radius-md)] transition-colors font-medium"
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

                  <ProgressionChart
                    data={progressionData}
                    metric={metricFilter}
                    exerciseName={activeExercise}
                  />

                  {progressionData.length >= 2 && (
                    <div
                      className="pt-2 flex items-center justify-between text-[0.75rem]"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                    >
                      <span style={{ color: 'var(--text-tertiary)' }}>Mejor registro</span>
                      <span
                        className="font-semibold"
                        style={{ color: 'var(--interactive-primary)' }}
                      >
                        {progressionData[progressionData.length - 1]?.value.toFixed(1)} kg
                      </span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </section>

        {/* ── Recuperación ── */}
        <FatigueAnalysis
          muscleGroups={muscleRecovery}
          daysSinceLastWorkout={daysSinceLast}
          suggestedGroup={suggestedGroup}
        />

        {/* ── Calculadora 1RM ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-[var(--radius-xl)] p-4"
          style={{ backgroundColor: 'var(--bg-surface)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-4 h-4" style={{ color: 'var(--interactive-primary)' }} />
            <span
              className="text-[0.9375rem] font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              Calculadora 1RM
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[0.75rem] mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                Peso (kg)
              </div>
              <input
                type="number"
                placeholder="100"
                value={rmWeight}
                onChange={(e) => {
                  setRmWeight(e.target.value);
                  calcRM(e.target.value, rmReps);
                }}
                className="w-full rounded-[var(--radius-md)] text-base p-3 outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <div className="text-[0.75rem] mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                Reps
              </div>
              <input
                type="number"
                placeholder="10"
                value={rmReps}
                onChange={(e) => {
                  setRmReps(e.target.value);
                  calcRM(rmWeight, e.target.value);
                }}
                className="w-full rounded-[var(--radius-md)] text-base p-3 outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>
          <div className="mt-4 text-center">
            <div className="text-[0.6875rem] mb-1" style={{ color: 'var(--text-tertiary)' }}>
              1RM estimado
            </div>
            <div
              className="text-3xl font-bold font-mono"
              style={{ color: 'var(--interactive-primary)' }}
            >
              {rmResult ? `${rmResult.toFixed(1)} kg` : '—'}
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
