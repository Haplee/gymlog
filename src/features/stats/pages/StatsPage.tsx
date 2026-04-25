import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import { Layout } from '@app/components/Layout';
import { format, subWeeks, startOfWeek, eachWeekOfInterval, parseISO, subDays } from 'date-fns';
import { fetchWorkoutsAndSets } from '@shared/api/queries';
import { calcular1RM } from '@shared/lib/brzycki';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { KPICard } from '../components/KPICards';
import { FatigueAnalysis } from '../components/FatigueAnalysis';
import {
  calculateCurrentStreak,
  calculateMaxStreak,
  calculateWeeklyVolume,
  calculatePreviousWeekVolume,
  calculateSessionCountLast30Days,
  calculateVolumeChangePercent,
  calculateAverageSessionDuration,
  calculateTotalPRs,
} from '../utils/kpiCalculations';
import { buildProgressionData } from '../utils/progressionMetrics';
import {
  analyzeMuscleRecovery,
  getSuggestedMuscleGroup,
  getDaysSinceLastWorkout,
} from '../utils/fatigueAnalysis';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { TrendingUp, Target, Calculator } from 'lucide-react';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const CHART_COLORS = [
  '#c8ff00',
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#14b8a6',
  '#f97316',
  '#a855f7',
];

type PeriodFilter = '4semanas' | '3meses' | '6meses' | '1año';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  '4semanas': '4 sem',
  '3meses': '3 mes',
  '6meses': '6 mes',
  '1año': '1 año',
};

function calculateMuscleGroupDistribution(
  sets: { exercise?: { muscle_group?: string | null } | null }[],
) {
  const distribution: Record<string, number> = {};

  sets.forEach((s) => {
    const muscleGroup = s.exercise?.muscle_group || 'Otro';
    distribution[muscleGroup] = (distribution[muscleGroup] || 0) + 1;
  });

  return Object.entries(distribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function MuscleGroupChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) return null;

  return (
    <div className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--bg-surface-3)',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
            }}
            formatter={(value) => [`${value} series`, 'Series']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center gap-1.5 text-[0.6875rem]">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="text-[var(--text-secondary)]">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('4semanas');
  const [metricFilter, setMetricFilter] = useState<'1rm' | 'maxWeight' | 'volume'>('1rm');
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

  useEffect(() => {
    if (error) {
      console.error('Error fetching stats data:', error);
      toast.error('Error al cargar las estadísticas');
    }
  }, [error]);

  const workouts = data?.workouts || [];
  const recentSets = data?.sets || [];

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
  const totalPRs = useMemo(() => calculateTotalPRs(recentSets), [recentSets]);

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

  const periodWeeks: Record<PeriodFilter, number> = {
    '4semanas': 4,
    '3meses': 12,
    '6meses': 24,
    '1año': 52,
  };

  const weeklyVolumeData = useMemo(() => {
    const weeks = periodWeeks[periodFilter];
    const now = new Date();
    const start = subWeeks(now, weeks);
    const weekStarts = eachWeekOfInterval({ start, end: now }).map((w) => startOfWeek(w));

    return weekStarts
      .map((weekStart, i) => {
        const weekEnd = subDays(weekStart, -7);
        const vol = recentSets
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

  const calcRM = (weight: string, reps: string) => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (w && r) {
      setRmResult(calcular1RM(w, r));
    } else {
      setRmResult(null);
    }
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
      <motion.div
        className="grid grid-cols-2 gap-3 mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <KPICard
          title="Racha actual"
          value={currentStreak}
          subtitle="semanas seguidas"
          icon="flame"
          isNewPR={currentStreak >= 3}
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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3 mb-4"
      >
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-4">
          <div className="text-[0.6875rem] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            Racha máxima
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[2rem] font-bold text-[var(--text-primary)] font-mono">
              {maxStreak}
            </span>
            <span className="text-[0.8125rem] text-[var(--text-secondary)]">semanas</span>
          </div>
        </div>
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-4">
          <div className="text-[0.6875rem] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            Récords personales
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[2rem] font-bold text-[var(--warning)] font-mono">
              {totalPRs}
            </span>
            <span className="text-[0.8125rem] text-[var(--text-secondary)]">PRs</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-4 mb-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--interactive-primary)' }} />
            <span className="text-[0.8125rem] font-medium text-[var(--text-secondary)]">
              Volumen semanal
            </span>
          </div>
          <div className="flex gap-1">
            {periodButtons.map((p) => (
              <button
                key={p}
                onClick={() => setPeriodFilter(p)}
                className={`text-[0.625rem] px-2 py-1 rounded-[var(--radius-pill)] transition-colors ${
                  periodFilter === p
                    ? 'bg-[var(--interactive-primary)] text-[var(--interactive-primary-fg)] font-medium'
                    : 'bg-[var(--bg-surface-2)] text-[var(--text-tertiary)]'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyVolumeData}>
              <defs>
                <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--interactive-primary)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--interactive-primary)" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="week"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface-3)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                }}
                labelStyle={{ color: 'var(--text-secondary)' }}
                formatter={(value) => [`${Number(value).toLocaleString()} kg`, 'Volumen']}
              />
              <Bar dataKey="vol" fill="url(#volumeGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {muscleGroupDistribution.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-4 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4" style={{ color: 'var(--interactive-primary)' }} />
            <span className="text-[0.8125rem] font-medium text-[var(--text-secondary)]">
              Grupos musculares
            </span>
          </div>
          <MuscleGroupChart data={muscleGroupDistribution} />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-4 mb-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5" style={{ color: 'var(--interactive-primary)' }} />
          <div className="text-[0.9375rem] font-semibold text-[var(--text-primary)]">
            Progresión
          </div>
        </div>

        {uniqueExercises.length > 0 && (
          <>
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="w-full bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-sm p-3 mb-3"
            >
              {uniqueExercises.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>

            <div className="flex gap-1 mb-3">
              {metricButtons.map((m) => (
                <button
                  key={m}
                  onClick={() => setMetricFilter(m)}
                  className={`flex-1 text-[0.6875rem] py-1.5 rounded-[var(--radius-md)] transition-colors ${
                    metricFilter === m
                      ? 'bg-[var(--interactive-primary)] text-[var(--interactive-primary-fg)]'
                      : 'bg-[var(--bg-surface-2)] text-[var(--text-tertiary)]'
                  }`}
                >
                  {m === '1rm' ? '1RM' : m === 'maxWeight' ? 'Peso máx' : 'Volumen'}
                </button>
              ))}
            </div>

            {progressionData.length >= 2 ? (
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressionData}>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => format(parseISO(v), 'dd/MM')}
                    />
                    <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-surface-3)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: 'var(--text-secondary)' }}
                      formatter={(value) => [
                        `${Number(value)} kg`,
                        metricFilter === '1rm'
                          ? '1RM estimado'
                          : metricFilter === 'maxWeight'
                            ? 'Peso máx'
                            : 'Volumen',
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--interactive-primary)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--text-tertiary)] text-sm">
                Necesitas al menos 2 sesiones
              </div>
            )}
          </>
        )}
      </motion.div>

      <FatigueAnalysis
        muscleGroups={muscleRecovery}
        daysSinceLastWorkout={daysSinceLast}
        suggestedGroup={suggestedGroup}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-4 mt-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5" style={{ color: 'var(--interactive-primary)' }} />
          <div className="text-[0.9375rem] font-semibold text-[var(--text-primary)]">
            Calculadora 1RM
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[0.75rem] text-[var(--text-tertiary)] mb-1">Peso (kg)</div>
            <input
              type="number"
              placeholder="100"
              value={rmWeight}
              onChange={(e) => {
                setRmWeight(e.target.value);
                calcRM(e.target.value, rmReps);
              }}
              className="w-full bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-base p-3"
            />
          </div>
          <div>
            <div className="text-[0.75rem] text-[var(--text-tertiary)] mb-1">Reps</div>
            <input
              type="number"
              placeholder="10"
              value={rmReps}
              onChange={(e) => {
                setRmReps(e.target.value);
                calcRM(rmWeight, e.target.value);
              }}
              className="w-full bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-base p-3"
            />
          </div>
        </div>
        <div className="mt-4 text-center text-lg font-semibold text-[var(--interactive-primary)]">
          1RM: {rmResult ? `${rmResult.toFixed(1)} kg` : '-- kg'}
        </div>
      </motion.div>
    </Layout>
  );
}
