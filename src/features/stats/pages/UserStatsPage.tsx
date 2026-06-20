import { useMemo, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { m } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useCardioStore } from '@features/cardio/stores/cardioStore';
import { Layout } from '@app/components/Layout';
import { fetchWorkoutsAndSets, fetchPersonalRecords } from '@shared/api/queries';
import {
  calculateCurrentStreak,
  calculateMaxStreak,
  calculateWeeklyVolume,
  calculatePreviousWeekVolume,
  calculateSessionCountLast30Days,
  calculateVolumeChangePercent,
  calculateAverageSessionDuration,
  calculateAllTimePRsCount,
  isWorkingSet,
} from '../utils/kpiCalculations';
import { analyzeMuscleRecovery, getDaysSinceLastWorkout } from '../utils/fatigueAnalysis';
import { comparePeriods } from '../utils/periodComparison';
import { projectNextVolume } from '../utils/volumeProjection';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  Activity,
  Clock,
  Flame,
  BarChart3,
  Dumbbell,
  Medal,
  Weight,
  Calendar,
  type LucideIcon,
} from 'lucide-react';
import { computeAchievements } from '@shared/lib/achievements';
import { toast } from 'sonner';
import { format, subWeeks, startOfWeek, eachWeekOfInterval, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { calcular1RM } from '@shared/lib/brzycki';
import { SectionLabel } from '../components/userStats/SectionLabel';
import { DayFrequencyChart } from '../components/userStats/DayFrequencyChart';
import { TopExercisesList } from '../components/userStats/TopExercisesList';
import { BodyMeasurements } from '../components/userStats/BodyMeasurements';

// recharts es pesado: cargar estos charts bajo demanda lo saca del chunk de la página
const WeeklyVolumeChart = lazy(() =>
  import('../components/userStats/WeeklyVolumeChart').then((mod) => ({
    default: mod.WeeklyVolumeChart,
  })),
);
const MuscleDistributionChart = lazy(() =>
  import('../components/userStats/MuscleDistributionChart').then((mod) => ({
    default: mod.MuscleDistributionChart,
  })),
);

function ChartFallback() {
  return <div className="h-56 skeleton rounded-2xl" aria-hidden="true" />;
}
const PUSH_MUSCLES = ['Pecho', 'Hombro', 'Hombros', 'Tríceps'];
const PULL_MUSCLES = ['Espalda', 'Bíceps', 'Antebrazo', 'Espalda baja'];
const LEG_MUSCLES = [
  'Pierna',
  'Cuádriceps',
  'Isquiotibiales',
  'Glúteo',
  'Glúteos',
  'Piernas',
  'Gemelos',
];

function BigKPI({
  value,
  label,
  icon: Icon,
  color = 'var(--interactive-primary)',
  delay = 0,
}: {
  value: string | number;
  label: string;
  icon: React.ElementType;
  color?: string;
  delay?: number;
}) {
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      className="relative overflow-hidden rounded-card p-4 flex flex-col gap-2 bg-surface border border-line shadow-card"
    >
      {/* Tinte del color del KPI en el borde superior */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-14 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, color-mix(in srgb, ${color} 8%, transparent), transparent)`,
        }}
      />
      <div
        className="relative w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="relative font-mono font-bold text-2xl leading-none text-fg tabular-nums">
        {value}
      </div>
      <div className="relative text-xs text-fg-subtle">{label}</div>
    </m.div>
  );
}

interface Tip {
  type: 'warning' | 'success' | 'info' | 'danger';
  title: string;
  message: string;
}

function TipCard({ tip, index }: { tip: Tip; index: number }) {
  const config = {
    warning: {
      icon: AlertTriangle,
      color: 'var(--warning)',
      bg: 'color-mix(in srgb, var(--warning) 8%, transparent)',
      border: 'color-mix(in srgb, var(--warning) 20%, transparent)',
    },
    success: {
      icon: CheckCircle2,
      color: 'var(--success)',
      bg: 'color-mix(in srgb, var(--success) 8%, transparent)',
      border: 'color-mix(in srgb, var(--success) 20%, transparent)',
    },
    info: {
      icon: Lightbulb,
      color: 'var(--interactive-primary)',
      bg: 'color-mix(in srgb, var(--interactive-primary) 8%, transparent)',
      border: 'color-mix(in srgb, var(--interactive-primary) 15%, transparent)',
    },
    danger: {
      icon: AlertTriangle,
      color: 'var(--error)',
      bg: 'color-mix(in srgb, var(--error) 8%, transparent)',
      border: 'color-mix(in srgb, var(--error) 20%, transparent)',
    },
  }[tip.type];
  const Icon = config.icon;

  return (
    <m.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, type: 'spring', stiffness: 280, damping: 22 }}
      className="flex gap-3 p-3.5 rounded-2xl"
      style={{ backgroundColor: config.bg, border: `1px solid ${config.border}` }}
    >
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: config.color }} />
      <div>
        <div className="text-sm font-semibold mb-0.5 text-fg">{tip.title}</div>
        <div className="text-xs leading-relaxed text-fg-muted">{tip.message}</div>
      </div>
    </m.div>
  );
}

type TipT = (key: string, opts?: Record<string, number | string>) => string;

const mkTip = (type: Tip['type'], title: string, message: string): Tip => ({
  type,
  title,
  message,
});

function streakTip(t: TipT, streak: number): Tip | null {
  if (streak >= 7)
    return mkTip(
      'success',
      t('tips.streak_strong_title', { count: streak }),
      t('tips.streak_strong_msg'),
    );
  if (streak >= 3)
    return mkTip(
      'success',
      t('tips.streak_good_title', { count: streak }),
      t('tips.streak_good_msg'),
    );
  return null;
}

function restTip(t: TipT, daysSinceLast: number): Tip | null {
  if (daysSinceLast > 5)
    return mkTip(
      'danger',
      t('tips.rest_long_title'),
      t('tips.rest_long_msg', { count: daysSinceLast }),
    );
  if (daysSinceLast > 3)
    return mkTip(
      'warning',
      t('tips.rest_mid_title', { count: daysSinceLast }),
      t('tips.rest_mid_msg'),
    );
  return null;
}

function frequencyTip(t: TipT, sessionCount30d: number, totalWorkouts: number): Tip | null {
  if (sessionCount30d < 8 && totalWorkouts >= 5)
    return mkTip(
      'warning',
      t('tips.freq_low_title'),
      t('tips.freq_low_msg', { count: sessionCount30d }),
    );
  return null;
}

function volumeTip(t: TipT, volumeChange: number, weeklyVolume: number): Tip | null {
  if (volumeChange < -25)
    return mkTip(
      'warning',
      t('tips.vol_down_title', { pct: Math.abs(volumeChange) }),
      t('tips.vol_down_msg'),
    );
  if (volumeChange > 30)
    return mkTip('warning', t('tips.vol_up_title', { pct: volumeChange }), t('tips.vol_up_msg'));
  if (volumeChange > 0 && weeklyVolume > 0)
    return mkTip(
      'success',
      t('tips.vol_progress_title', { pct: volumeChange }),
      t('tips.vol_progress_msg'),
    );
  return null;
}

function balanceTips(t: TipT, muscleDistribution: { name: string; value: number }[]): Tip[] {
  if (muscleDistribution.length === 0) return [];
  const out: Tip[] = [];
  const sumWhere = (groups: string[]) =>
    muscleDistribution
      .filter((m) => groups.some((p) => m.name.includes(p)))
      .reduce((s, m) => s + m.value, 0);
  const pushVol = sumWhere(PUSH_MUSCLES);
  const pullVol = sumWhere(PULL_MUSCLES);
  const legVol = sumWhere(LEG_MUSCLES);
  const totalVol = muscleDistribution.reduce((s, m) => s + m.value, 0);

  if (pushVol > 0 && pullVol > 0 && pushVol > pullVol * 1.6)
    out.push(mkTip('warning', t('tips.balance_push_title'), t('tips.balance_push_msg')));
  else if (pushVol > 0 && pullVol > 0 && pullVol > pushVol * 1.6)
    out.push(mkTip('info', t('tips.balance_pull_title'), t('tips.balance_pull_msg')));

  if (totalVol > 0 && legVol / totalVol < 0.15 && legVol > 0)
    out.push(mkTip('warning', t('tips.legs_low_title'), t('tips.legs_low_msg')));
  else if (totalVol > 0 && legVol === 0 && muscleDistribution.length >= 3)
    out.push(mkTip('danger', t('tips.legs_none_title'), t('tips.legs_none_msg')));

  return out;
}

function prTip(t: TipT, recentPRsCount: number, sessionCount30d: number): Tip | null {
  if (recentPRsCount === 0 && sessionCount30d >= 8)
    return mkTip('info', t('tips.pr_none_title'), t('tips.pr_none_msg'));
  if (recentPRsCount >= 3)
    return mkTip(
      'success',
      t('tips.pr_streak_title', { count: recentPRsCount }),
      t('tips.pr_streak_msg'),
    );
  return null;
}

function durationTip(t: TipT, avgDuration: number): Tip | null {
  if (avgDuration > 0 && avgDuration < 30)
    return mkTip(
      'info',
      t('tips.dur_short_title'),
      t('tips.dur_short_msg', { count: avgDuration }),
    );
  if (avgDuration > 120)
    return mkTip(
      'warning',
      t('tips.dur_long_title'),
      t('tips.dur_long_msg', { count: avgDuration }),
    );
  return null;
}

function diversityTip(t: TipT, uniqueExercises: number, sessionCount30d: number): Tip | null {
  if (uniqueExercises < 4 && sessionCount30d >= 4)
    return mkTip(
      'info',
      t('tips.variety_low_title'),
      t('tips.variety_low_msg', { count: uniqueExercises }),
    );
  return null;
}

function generateTips(params: {
  sessionCount30d: number;
  currentStreak: number;
  daysSinceLast: number;
  volumeChange: number;
  weeklyVolume: number;
  muscleDistribution: { name: string; value: number }[];
  recentPRsCount: number;
  totalWorkouts: number;
  avgDuration: number;
  uniqueExercises: number;
  t: TipT;
}): Tip[] {
  const {
    sessionCount30d,
    currentStreak,
    daysSinceLast,
    volumeChange,
    weeklyVolume,
    muscleDistribution,
    recentPRsCount,
    totalWorkouts,
    avgDuration,
    uniqueExercises,
    t,
  } = params;

  // Sin datos suficientes
  if (totalWorkouts < 3) {
    return [mkTip('info', t('tips.start_title'), t('tips.start_msg'))];
  }

  const tips: Tip[] = [];
  const add = (tip: Tip | null) => {
    if (tip) tips.push(tip);
  };

  add(streakTip(t, currentStreak));
  add(restTip(t, daysSinceLast));
  add(frequencyTip(t, sessionCount30d, totalWorkouts));
  add(volumeTip(t, volumeChange, weeklyVolume));
  tips.push(...balanceTips(t, muscleDistribution));
  add(prTip(t, recentPRsCount, sessionCount30d));
  add(durationTip(t, avgDuration));
  add(diversityTip(t, uniqueExercises, sessionCount30d));

  // Sin tips de éxito — añadir algo positivo
  if (tips.filter((x) => x.type === 'success').length === 0 && totalWorkouts >= 10) {
    add(
      mkTip(
        'success',
        t('tips.consistency_title', { count: totalWorkouts }),
        t('tips.consistency_msg'),
      ),
    );
  }

  return tips.slice(0, 6);
}

export function UserStatsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { sessions: cardioSessions, syncFromRemote: syncCardio } = useCardioStore();

  useEffect(() => {
    if (user?.id) void syncCardio(user.id);
  }, [user?.id, syncCardio]);

  const { data, isLoading } = useQuery({
    queryKey: ['workoutsAndSets', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('No user');
      const result = await fetchWorkoutsAndSets(user.id);
      return result ?? { workouts: [], sets: [] };
    },
    enabled: !!user?.id,
    retry: 1,
  });

  const { data: personalRecords = [] } = useQuery({
    queryKey: ['personalRecords', user?.id],
    queryFn: () => fetchPersonalRecords(user?.id ?? ''),
    enabled: !!user?.id,
  });

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
  const sessionCount30d = useMemo(() => calculateSessionCountLast30Days(workouts), [workouts]);
  const daysSinceLast = useMemo(() => getDaysSinceLastWorkout(workouts), [workouts]);
  const avgDuration = useMemo(() => calculateAverageSessionDuration(workouts), [workouts]);
  const totalPRs = useMemo(() => calculateAllTimePRsCount(personalRecords), [personalRecords]);
  const muscleRecovery = useMemo(() => analyzeMuscleRecovery(recentSets), [recentSets]);
  const periodComparison = useMemo(() => comparePeriods(recentSets, 30), [recentSets]);

  // Muscle group distribution
  const muscleDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    recentSets.filter(isWorkingSet).forEach((s) => {
      const mg = s.exercise?.muscle_group || 'Otro';
      dist[mg] = (dist[mg] || 0) + s.weight * s.reps;
    });
    return Object.entries(dist)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [recentSets]);

  // Top exercises by volume
  const topExercises = useMemo(() => {
    const byEx: Record<string, { volume: number; sets: number; best1rm: number }> = {};
    recentSets.filter(isWorkingSet).forEach((s) => {
      const name = s.exercise?.name || 'Desconocido';
      if (!byEx[name]) byEx[name] = { volume: 0, sets: 0, best1rm: 0 };
      byEx[name].volume += s.weight * s.reps;
      byEx[name].sets++;
      const rm = calcular1RM(s.weight, s.reps);
      if (rm > byEx[name].best1rm) byEx[name].best1rm = rm;
    });
    return Object.entries(byEx)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 6);
  }, [recentSets]);

  // Weekly volume last 8 weeks
  const weeklyVolumeData = useMemo(() => {
    const now = new Date();
    const start = subWeeks(now, 8);
    const weekStarts = eachWeekOfInterval({ start, end: now }).map((w) =>
      startOfWeek(w, { weekStartsOn: 1 }),
    );
    return weekStarts.map((weekStart, i) => {
      const weekEnd = subDays(weekStart, -7);
      const vol = recentSets
        .filter(isWorkingSet)
        .filter((s) => {
          const d = s.workout?.started_at ? new Date(s.workout.started_at) : null;
          return d && d >= weekStart && d < weekEnd;
        })
        .reduce((sum, s) => sum + s.reps * s.weight, 0);
      return { week: `S${i + 1}`, vol, label: format(weekStart, 'dd/MM', { locale: es }) };
    });
  }, [recentSets]);

  const volumeProjection = useMemo(
    () => projectNextVolume(weeklyVolumeData.map((w) => w.vol)),
    [weeklyVolumeData],
  );

  // Workout frequency by day of week
  const dayFrequency = useMemo(() => {
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    workouts.forEach((w) => {
      if (!w.started_at) return;
      const d = new Date(w.started_at).getDay();
      const idx = d === 0 ? 6 : d - 1;
      counts[idx]++;
    });
    const max = Math.max(...counts, 1);
    return days.map((day, i) => ({
      day,
      count: counts[i],
      pct: Math.round((counts[i] / max) * 100),
    }));
  }, [workouts]);

  // Total volume all time
  const totalVolumeAllTime = useMemo(
    () => recentSets.filter(isWorkingSet).reduce((sum, s) => sum + s.weight * s.reps, 0),
    [recentSets],
  );

  // Logros
  const achievements = useMemo(
    () =>
      computeAchievements({
        totalWorkouts: workouts.length,
        maxStreak,
        totalVolumeKg: totalVolumeAllTime,
        prCount: totalPRs,
        sessions30d: sessionCount30d,
      }),
    [workouts.length, maxStreak, totalVolumeAllTime, totalPRs, sessionCount30d],
  );

  // Detecta logros recién desbloqueados (no en la primera carga) → toast + confetti.
  useEffect(() => {
    const unlocked = achievements.filter((a) => a.unlocked).map((a) => a.id);
    const raw = localStorage.getItem('gymlog-achievements-seen');
    if (raw === null) {
      localStorage.setItem('gymlog-achievements-seen', JSON.stringify(unlocked));
      return;
    }
    let seen: string[] = [];
    try {
      seen = JSON.parse(raw);
    } catch {
      seen = [];
    }
    const fresh = unlocked.filter((id) => !seen.includes(id));
    if (fresh.length) {
      fresh.forEach((id) =>
        toast.success(`${t('achievements.unlocked_toast')} ${t(`achievements.${id}`)}`),
      );
      void import('canvas-confetti')
        .then((m) =>
          m.default({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#c8ff00', '#ffffff'],
          }),
        )
        .catch(() => {});
      localStorage.setItem('gymlog-achievements-seen', JSON.stringify(unlocked));
    }
  }, [achievements, t]);

  // Unique exercises count
  const uniqueExercisesCount = useMemo(
    () => new Set(recentSets.map((s) => s.exercise?.name).filter(Boolean)).size,
    [recentSets],
  );

  // Recent PRs (last 30 days)
  const recentPRsCount = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return personalRecords.filter(
      (pr) => pr.achieved_at && new Date(pr.achieved_at) >= thirtyDaysAgo,
    ).length;
  }, [personalRecords]);

  // Best workout day
  const bestDay = useMemo(() => {
    const max = dayFrequency.reduce(
      (best, d) => (d.count > best.count ? d : best),
      dayFrequency[0],
    );
    return max?.count > 0 ? max.day : null;
  }, [dayFrequency]);

  // Cardio total time
  const cardioTotalMin = useMemo(
    () => Math.round(cardioSessions.reduce((sum, s) => sum + s.duration, 0) / 60),
    [cardioSessions],
  );

  const tips = useMemo(
    () =>
      generateTips({
        sessionCount30d,
        currentStreak,
        daysSinceLast,
        volumeChange,
        weeklyVolume,
        muscleDistribution,
        recentPRsCount,
        totalWorkouts: workouts.length,
        avgDuration,
        uniqueExercises: uniqueExercisesCount,
        t,
      }),
    [
      sessionCount30d,
      currentStreak,
      daysSinceLast,
      volumeChange,
      weeklyVolume,
      muscleDistribution,
      recentPRsCount,
      workouts.length,
      avgDuration,
      uniqueExercisesCount,
      t,
    ],
  );

  if (!user) {
    navigate('/login');
    return null;
  }

  if (isLoading) {
    return (
      <Layout>
        {/* Replica el layout real: header + grid KPI 2col + chart */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="skeleton w-11 h-11 rounded-xl" />
            <div className="skeleton h-5 w-40 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-28 rounded-card" />
            ))}
          </div>
          <div className="skeleton h-56 rounded-2xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Back header */}
      <m.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-5"
      >
        <button
          onClick={() => navigate(-1)}
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors bg-surface border border-line hover:bg-surface-2"
        >
          <ArrowLeft className="w-4 h-4 text-fg-muted" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-fg text-balance">
            {t('userStats.page_title')}
          </h1>
          <p className="text-xs text-fg-subtle">{t('userStats.page_subtitle')}</p>
        </div>
      </m.div>

      <div className="space-y-5">
        {/* ── Hero KPIs ── */}
        <section className="space-y-3">
          <SectionLabel>{t('userStats.global_summary')}</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <BigKPI
              value={workouts.length}
              label="Entrenamientos totales"
              icon={Activity}
              color="var(--interactive-primary)"
              delay={0}
            />
            <BigKPI
              value={`${(totalVolumeAllTime / 1000).toFixed(0)}t`}
              label="Volumen total"
              icon={BarChart3}
              color="var(--accent-blue)"
              delay={0.05}
            />
            <BigKPI
              value={totalPRs}
              label="Records personales"
              icon={Trophy}
              color="var(--accent-amber)"
              delay={0.1}
            />
            <BigKPI
              value={currentStreak}
              label={`días de racha${maxStreak > currentStreak ? ` (máx. ${maxStreak})` : ''}`}
              icon={Flame}
              color="var(--error)"
              delay={0.15}
            />
          </div>

          {/* Secondary row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: sessionCount30d, label: 'sesiones/30d', color: 'var(--accent-green)' },
              { value: `${avgDuration}m`, label: 'duración media', color: 'var(--accent-violet)' },
              {
                value: uniqueExercisesCount,
                label: 'ejercicios distintos',
                color: 'var(--accent-sky)',
              },
            ].map((item, i) => (
              <m.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.04 }}
                className="rounded-2xl p-3 text-center bg-surface border border-line shadow-card"
              >
                <div
                  className="font-mono font-bold text-xl tabular-nums"
                  style={{ color: item.color }}
                >
                  {item.value}
                </div>
                <div className="text-2xs mt-1 text-fg-subtle">{item.label}</div>
              </m.div>
            ))}
          </div>

          {cardioTotalMin > 0 && (
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl p-3.5 flex items-center justify-between bg-surface border border-line"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: 'var(--accent-sky)' }} />
                <span className="text-sm text-fg-muted">{t('userStats.cardio_total_time')}</span>
              </div>
              <span
                className="font-mono font-semibold text-sm"
                style={{ color: 'var(--accent-sky)' }}
              >
                {cardioTotalMin >= 60
                  ? `${Math.floor(cardioTotalMin / 60)}h ${cardioTotalMin % 60}m`
                  : `${cardioTotalMin}m`}
              </span>
            </m.div>
          )}
        </section>

        {/* ── Logros ── */}
        <section className="space-y-3">
          <SectionLabel>{t('achievements.title')}</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {achievements.map((a, i) => {
              const ACH_ICONS: Record<string, LucideIcon> = {
                dumbbell: Dumbbell,
                medal: Medal,
                flame: Flame,
                weight: Weight,
                trophy: Trophy,
                calendar: Calendar,
              };
              const Icon = ACH_ICONS[a.icon] ?? Trophy;
              return (
                <m.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * i }}
                  className={`rounded-2xl p-3 flex items-center gap-3 border shadow-card ${
                    a.unlocked
                      ? 'bg-surface border-line-accent'
                      : 'bg-surface border-line opacity-60'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      a.unlocked ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-fg-subtle'
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate text-fg">
                      {t(`achievements.${a.id}`)}
                    </div>
                    {!a.unlocked && (
                      <div className="mt-1 h-1 rounded-full bg-surface-2 overflow-hidden">
                        <div
                          className="h-full bg-accent/60 rounded-full"
                          style={{ width: `${Math.round(a.progress * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </m.div>
              );
            })}
          </div>
        </section>

        {/* ── Medidas corporales ── */}
        <BodyMeasurements userId={user.id} />

        {/* ── Volumen semanal ── */}
        {weeklyVolumeData.some((w) => w.vol > 0) && (
          <Suspense fallback={<ChartFallback />}>
            <WeeklyVolumeChart data={weeklyVolumeData} volumeChange={volumeChange} />
          </Suspense>
        )}

        {/* ── Comparación de periodo + proyección ── */}
        {(periodComparison.current.volume > 0 || periodComparison.previous.volume > 0) && (
          <section className="space-y-3">
            <SectionLabel>{t('stats.comparison_title')}</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { key: 'current', stats: periodComparison.current },
                  { key: 'previous', stats: periodComparison.previous },
                ] as const
              ).map(({ key, stats }) => (
                <div
                  key={key}
                  className="rounded-card p-4 bg-surface border border-line shadow-card"
                >
                  <div className="text-2xs uppercase font-semibold text-fg-subtle">
                    {t(`stats.comparison_${key}`)}
                  </div>
                  <div className="font-mono font-bold text-2xl text-fg mt-1 tabular-nums">
                    {(stats.volume / 1000).toFixed(1)}t
                  </div>
                  <div className="text-xs text-fg-subtle">
                    {stats.sessions} {t('stats.comparison_sessions')}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="text-sm font-semibold text-center"
              style={{
                color: periodComparison.volumeChangePct >= 0 ? 'var(--success)' : 'var(--error)',
              }}
            >
              {periodComparison.volumeChangePct >= 0 ? '+' : ''}
              {periodComparison.volumeChangePct}% volumen
            </div>

            {volumeProjection && (
              <div className="rounded-card p-4 bg-surface border border-line shadow-card flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-fg">{t('stats.projection_title')}</div>
                  <div className="text-xs text-fg-subtle">
                    {t(`stats.trend_${volumeProjection.trend}`)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-xl text-accent tabular-nums">
                    {(volumeProjection.projected / 1000).toFixed(1)}t
                  </div>
                  <div className="text-2xs text-fg-subtle">{t('stats.projection_next')}</div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Día favorito ── */}
        {workouts.length >= 3 && <DayFrequencyChart data={dayFrequency} bestDay={bestDay} />}

        {/* ── Distribución muscular ── */}
        {muscleDistribution.length > 0 && (
          <Suspense fallback={<ChartFallback />}>
            <MuscleDistributionChart data={muscleDistribution} />
          </Suspense>
        )}

        {/* ── Top ejercicios ── */}
        {topExercises.length > 0 && <TopExercisesList data={topExercises} />}

        {/* ── Estado muscular ── */}
        {muscleRecovery.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Estado de recuperación</SectionLabel>
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-card p-4 bg-surface border border-line shadow-card"
            >
              <div className="space-y-2">
                {muscleRecovery.slice(0, 6).map(({ name, daysSinceLast, status }) => {
                  const colors = {
                    fresh: {
                      dot: 'var(--success)',
                      label: t('userStats.recovery_rested'),
                      bg: 'color-mix(in srgb, var(--success) 10%, transparent)',
                    },
                    moderate: {
                      dot: 'var(--warning)',
                      label: t('userStats.recovery_moderate'),
                      bg: 'color-mix(in srgb, var(--warning) 10%, transparent)',
                    },
                    'needs-attention': {
                      dot: 'var(--error)',
                      label: t('userStats.recovery_needs_work'),
                      bg: 'color-mix(in srgb, var(--error) 10%, transparent)',
                    },
                  }[status];
                  return (
                    <div
                      key={name}
                      className="flex items-center justify-between p-2.5 rounded-xl"
                      style={{ backgroundColor: colors.bg }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: colors.dot }}
                        />
                        <span className="text-sm font-medium text-fg">{name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-fg-subtle">
                          {daysSinceLast >= 0
                            ? t('userStats.days_ago', { count: daysSinceLast })
                            : t('userStats.no_data_label')}
                        </span>
                        <span
                          className="text-2xs font-semibold px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${colors.dot} 13%, transparent)`,
                            color: colors.dot,
                          }}
                        >
                          {colors.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </m.div>
          </section>
        )}

        {/* ── Consejos ── */}
        {tips.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>{t('userStats.personalized_tips')}</SectionLabel>
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-card p-4 bg-surface border border-line shadow-card"
            >
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-4 h-4 text-warning" />
                <span className="text-sm font-semibold text-fg">
                  {tips.length} consejo{tips.length !== 1 ? 's' : ''} basados en tus datos
                </span>
              </div>
              <div className="space-y-2.5">
                {tips.map((tip, i) => (
                  <TipCard key={i} tip={tip} index={i} />
                ))}
              </div>
            </m.div>
          </section>
        )}

        {/* Sin datos */}
        {workouts.length === 0 && (
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <div className="text-5xl mb-4">📊</div>
            <div className="text-base font-semibold mb-2 text-fg">{t('userStats.empty_title')}</div>
            <div className="text-sm text-fg-subtle">{t('userStats.empty_desc')}</div>
          </m.div>
        )}
      </div>
    </Layout>
  );
}
