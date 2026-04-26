import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import { Layout } from '@app/components/Layout';
import { format, subWeeks, startOfWeek, eachWeekOfInterval, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { fetchWorkoutsAndSets, fetchPersonalRecords } from '@shared/api/queries';
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
import {
  TrendingUp,
  Target,
  Calculator,
  Activity,
  ChevronDown,
  Dumbbell,
  Trophy,
} from 'lucide-react';

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
  AreaChart,
  Area,
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
];

type PeriodFilter = '4semanas' | '3meses' | '6meses' | '1año';
type ChartView = 'bar' | 'area';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  '4semanas': '4 sem',
  '3meses': '3 mes',
  '6meses': '6 mes',
  '1año': '1 año',
};

function calculateMuscleGroupDistribution(
  sets: { weight: number; reps: number; exercise?: { muscle_group?: string | null } | null }[],
) {
  const distribution: Record<string, number> = {};

  sets.forEach((s) => {
    const muscleGroup = s.exercise?.muscle_group || 'Otro';
    const volume = s.weight * s.reps;
    distribution[muscleGroup] = (distribution[muscleGroup] || 0) + volume;
  });

  return Object.entries(distribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function MuscleGroupChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={65}
              paddingAngle={2}
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
                fontSize: 12,
              }}
              formatter={(value) => {
                const numVal = typeof value === 'number' ? value : Number(value);
                return [
                  !isNaN(numVal) && numVal > 0
                    ? `${(numVal / 1000).toFixed(1)}t (${Math.round((numVal / total) * 100)}%)`
                    : `${value}`,
                  'Volumen',
                ];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 max-h-[120px] overflow-y-auto">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pr-2">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="text-[0.75rem] text-[var(--text-secondary)] truncate flex-1">
                {item.name}
              </span>
              <span className="text-[0.6875rem] text-[var(--text-tertiary)]">
                {(item.value / 1000).toFixed(1)}t
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VolumeChart({
  data,
  view,
  onViewChange,
}: {
  data: { week: string; vol: number }[];
  view: ChartView;
  onViewChange: (v: ChartView) => void;
}) {
  const maxVol = Math.max(...data.map((d) => d.vol), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {(['bar', 'area'] as ChartView[]).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`text-[0.625rem] px-2 py-1 rounded-[var(--radius-pill)] transition-colors ${
                view === v
                  ? 'bg-[var(--interactive-primary)] text-[var(--interactive-primary-fg)]'
                  : 'bg-[var(--bg-surface-2)] text-[var(--text-tertiary)]'
              }`}
            >
              {v === 'bar' ? 'Barras' : 'Línea'}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          {view === 'bar' ? (
            <BarChart data={data} barCategoryGap="30%">
              <defs>
                <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--interactive-primary)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--interactive-primary)" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="week"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={[0, maxVol * 1.1]} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface-3)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--text-secondary)' }}
                formatter={(value) => {
                  const numVal = typeof value === 'number' ? value : Number(value);
                  return [
                    !isNaN(numVal) && numVal > 0 ? `${(numVal / 1000).toFixed(1)}t` : `${value}`,
                    'Volumen',
                  ];
                }}
              />
              <Bar dataKey="vol" fill="url(#volumeGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--interactive-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--interactive-primary)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="week"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={[0, maxVol * 1.1]} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface-3)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--text-secondary)' }}
                formatter={(value) => {
                  const numVal = typeof value === 'number' ? value : Number(value);
                  return [
                    !isNaN(numVal) && numVal > 0 ? `${(numVal / 1000).toFixed(1)}t` : `${value}`,
                    'Volumen',
                  ];
                }}
              />
              <Area
                type="monotone"
                dataKey="vol"
                stroke="var(--interactive-primary)"
                strokeWidth={2}
                fill="url(#areaGradient)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ProgressionChart({
  data,
  metric,
  exerciseName,
}: {
  data: { date: string; value: number; isPR: boolean }[];
  metric: '1rm' | 'maxWeight' | 'volume';
  exerciseName: string;
}) {
  if (data.length < 2) {
    return (
      <div className="text-center py-8 text-[var(--text-tertiary)] text-sm">
        <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Necesitas al menos 2 sesiones de {exerciseName} para ver la progresión</p>
      </div>
    );
  }

  const metricLabel = metric === '1rm' ? '1RM' : metric === 'maxWeight' ? 'Peso máx' : 'Volumen';

  return (
    <div className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <defs>
            <linearGradient id="progressionGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--interactive-primary)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--interactive-primary)" stopOpacity={1} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-tertiary)', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => format(parseISO(v), 'dd/MM')}
          />
          <YAxis hide domain={['dataMin - 5', 'dataMax + 10']} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-surface-3)',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--text-secondary)' }}
            labelFormatter={(v) => format(parseISO(v as string), 'dd MMM', { locale: es })}
            formatter={(value) => {
              const numVal = typeof value === 'number' ? value : Number(value);
              return [`${!isNaN(numVal) ? numVal.toFixed(1) : value} kg`, metricLabel];
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--interactive-primary)"
            strokeWidth={2.5}
            dot={(props: {
              cx?: number;
              cy?: number;
              payload?: { isPR: boolean; value: number };
            }) => {
              if (!props.cx || !props.cy || !props.payload) return null;
              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={props.payload.isPR ? 5 : 3}
                  fill={props.payload.isPR ? 'var(--warning)' : 'var(--interactive-primary)'}
                  stroke="var(--bg-surface)"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 6, fill: 'var(--interactive-primary)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
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
    queryFn: () => fetchPersonalRecords(user!.id),
    enabled: !!user?.id,
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
    const weekStarts = eachWeekOfInterval({ start, end: now }).map((w) =>
      startOfWeek(w, { weekStartsOn: 1 }),
    );

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
      <div className="space-y-4">
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

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4" style={{ color: 'var(--warning)' }} />
              <span className="text-[0.6875rem] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                Racha máxima
              </span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[2rem] font-bold text-[var(--text-primary)] font-mono">
                {maxStreak}
              </span>
              <span className="text-[0.8125rem] text-[var(--text-secondary)] pb-1">días</span>
            </div>
          </div>
          <div className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4" style={{ color: 'var(--interactive-primary)' }} />
              <span className="text-[0.6875rem] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                Récords personales
              </span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[2rem] font-bold text-[var(--warning)] font-mono">
                {totalPRs}
              </span>
              <span className="text-[0.8125rem] text-[var(--text-secondary)] pb-1">
                PRs totales
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-4"
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
          <VolumeChart data={weeklyVolumeData} view={chartView} onViewChange={setChartView} />
          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[0.75rem]">
            <span className="text-[var(--text-tertiary)]">
              Volumen total ({PERIOD_LABELS[periodFilter]})
            </span>
            <span className="font-semibold text-[var(--text-primary)]">
              {(weeklyVolumeData.reduce((s, d) => s + d.vol, 0) / 1000).toFixed(1)}t
            </span>
          </div>
        </motion.div>

        {muscleGroupDistribution.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4" style={{ color: 'var(--interactive-primary)' }} />
              <span className="text-[0.8125rem] font-medium text-[var(--text-secondary)]">
                Distribución por grupo muscular
              </span>
            </div>
            <MuscleGroupChart data={muscleGroupDistribution} />
          </motion.div>
        )}

        {uniqueExercises.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5" style={{ color: 'var(--interactive-primary)' }} />
                <div className="text-[0.9375rem] font-semibold text-[var(--text-primary)]">
                  Progresión por ejercicio
                </div>
              </div>
              <button
                onClick={() => setShowProgression(!showProgression)}
                className="flex items-center gap-1 text-[0.75rem] text-[var(--text-tertiary)]"
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
                  className="w-full bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-sm p-3"
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
                      className={`flex-1 text-[0.6875rem] py-2 rounded-[var(--radius-md)] transition-colors font-medium ${
                        metricFilter === m
                          ? 'bg-[var(--interactive-primary)] text-[var(--interactive-primary-fg)]'
                          : 'bg-[var(--bg-surface-2)] text-[var(--text-tertiary)]'
                      }`}
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
                  <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[0.75rem]">
                    <span className="text-[var(--text-tertiary)]">Mejor registro</span>
                    <span className="font-semibold text-[var(--interactive-primary)]">
                      {progressionData[progressionData.length - 1]?.value.toFixed(1)} kg
                    </span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        <FatigueAnalysis
          muscleGroups={muscleRecovery}
          daysSinceLastWorkout={daysSinceLast}
          suggestedGroup={suggestedGroup}
        />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-4"
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
          <div className="mt-4 text-center">
            <div className="text-[0.6875rem] text-[var(--text-tertiary)] mb-1">Tu 1RM estimado</div>
            <div className="text-3xl font-bold text-[var(--interactive-primary)] font-mono">
              {rmResult ? `${rmResult.toFixed(1)} kg` : '-- kg'}
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
