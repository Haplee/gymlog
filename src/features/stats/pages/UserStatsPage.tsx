import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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
} from '../utils/kpiCalculations';
import { analyzeMuscleRecovery, getDaysSinceLastWorkout } from '../utils/fatigueAnalysis';
import {
  ArrowLeft,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Trophy,
  Target,
  Activity,
  Clock,
  Flame,
  BarChart3,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { format, subWeeks, startOfWeek, eachWeekOfInterval, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { calcular1RM } from '@shared/lib/brzycki';

const CHART_COLORS = [
  '#c8ff00',
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
];
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
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      className="rounded-[var(--radius-xl)] p-4 flex flex-col gap-2"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div
        className="font-mono font-bold text-2xl leading-none"
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </div>
      <div className="text-[0.6875rem]" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </div>
    </motion.div>
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
      color: '#ffd60a',
      bg: 'rgba(255,214,10,0.08)',
      border: 'rgba(255,214,10,0.2)',
    },
    success: {
      icon: CheckCircle2,
      color: '#30d158',
      bg: 'rgba(48,209,88,0.08)',
      border: 'rgba(48,209,88,0.2)',
    },
    info: {
      icon: Lightbulb,
      color: '#c8ff00',
      bg: 'rgba(200,255,0,0.08)',
      border: 'rgba(200,255,0,0.15)',
    },
    danger: {
      icon: AlertTriangle,
      color: '#ff453a',
      bg: 'rgba(255,69,58,0.08)',
      border: 'rgba(255,69,58,0.2)',
    },
  }[tip.type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, type: 'spring', stiffness: 280, damping: 22 }}
      className="flex gap-3 p-3.5 rounded-[var(--radius-lg)]"
      style={{ backgroundColor: config.bg, border: `1px solid ${config.border}` }}
    >
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: config.color }} />
      <div>
        <div
          className="text-[0.8125rem] font-semibold mb-0.5"
          style={{ color: 'var(--text-primary)' }}
        >
          {tip.title}
        </div>
        <div className="text-[0.75rem] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {tip.message}
        </div>
      </div>
    </motion.div>
  );
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
}): Tip[] {
  const tips: Tip[] = [];
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
  } = params;

  // Sin datos suficientes
  if (totalWorkouts < 3) {
    tips.push({
      type: 'info',
      title: 'Comienza tu historial',
      message:
        'Registra al menos 3 entrenamientos para recibir consejos personalizados basados en tus datos.',
    });
    return tips;
  }

  // Racha positiva
  if (currentStreak >= 7) {
    tips.push({
      type: 'success',
      title: `¡Racha de ${currentStreak} días!`,
      message:
        'Consistencia brutal. Asegúrate de incluir al menos 1-2 días de descanso activo por semana para optimizar la recuperación.',
    });
  } else if (currentStreak >= 3) {
    tips.push({
      type: 'success',
      title: `Buena racha — ${currentStreak} días`,
      message:
        'Vas por buen camino. Mantén el ritmo y prioriza el sueño para maximizar las ganancias.',
    });
  }

  // Descanso excesivo
  if (daysSinceLast > 5) {
    tips.push({
      type: 'danger',
      title: 'Demasiado tiempo sin entrenar',
      message: `Llevas ${daysSinceLast} días sin registrar un entrenamiento. La consistencia es el factor #1 para el progreso. ¡Vuelve hoy!`,
    });
  } else if (daysSinceLast > 3) {
    tips.push({
      type: 'warning',
      title: `${daysSinceLast} días sin entrenar`,
      message:
        'Es normal descansar, pero si llevas más de 3 días sin entrenar planifica tu próxima sesión cuanto antes.',
    });
  }

  // Frecuencia baja
  if (sessionCount30d < 8 && totalWorkouts >= 5) {
    tips.push({
      type: 'warning',
      title: 'Frecuencia baja',
      message: `Solo ${sessionCount30d} sesiones en los últimos 30 días. Para progresar consistentemente, apunta a 3-4 sesiones semanales.`,
    });
  }

  // Volumen
  if (volumeChange < -25) {
    tips.push({
      type: 'warning',
      title: `Volumen cayó un ${Math.abs(volumeChange)}%`,
      message:
        'El volumen semanal bajó significativamente. Puede ser por un descanso planeado (bien) o falta de consistencia. Revisa tu plan.',
    });
  } else if (volumeChange > 30) {
    tips.push({
      type: 'warning',
      title: `Volumen subió un ${volumeChange}%`,
      message:
        'Gran aumento de volumen. Asegúrate de que el incremento sea progresivo (máx. 10-15%/semana) para evitar sobreentrenamiento.',
    });
  } else if (volumeChange > 0 && weeklyVolume > 0) {
    tips.push({
      type: 'success',
      title: `+${volumeChange}% de volumen esta semana`,
      message:
        'Progresión constante de volumen. Sigues acumulando estímulo de entrenamiento de forma correcta.',
    });
  }

  // Balance push/pull
  if (muscleDistribution.length > 0) {
    const pushVol = muscleDistribution
      .filter((m) => PUSH_MUSCLES.some((p) => m.name.includes(p)))
      .reduce((s, m) => s + m.value, 0);
    const pullVol = muscleDistribution
      .filter((m) => PULL_MUSCLES.some((p) => m.name.includes(p)))
      .reduce((s, m) => s + m.value, 0);
    const legVol = muscleDistribution
      .filter((m) => LEG_MUSCLES.some((p) => m.name.includes(p)))
      .reduce((s, m) => s + m.value, 0);
    const totalVol = muscleDistribution.reduce((s, m) => s + m.value, 0);

    if (pushVol > 0 && pullVol > 0 && pushVol > pullVol * 1.6) {
      tips.push({
        type: 'warning',
        title: 'Desequilibrio empuje/tracción',
        message:
          'Estás entrenando más músculo de empuje (pecho/hombros) que de tracción (espalda/bíceps). Esto puede causar problemas posturales. Aumenta el volumen de espalda.',
      });
    } else if (pushVol > 0 && pullVol > 0 && pullVol > pushVol * 1.6) {
      tips.push({
        type: 'info',
        title: 'Más tracción que empuje',
        message:
          'Buen énfasis en espalda y bíceps. Considera equilibrar con ejercicios de pecho y hombros para un desarrollo completo.',
      });
    }

    if (totalVol > 0 && legVol / totalVol < 0.15 && legVol > 0) {
      tips.push({
        type: 'warning',
        title: 'Poco volumen de pierna',
        message:
          'Las piernas representan menos del 15% de tu volumen. Son el grupo muscular más grande del cuerpo — entrenarlas más mejora hormonas anabólicas y fuerza general.',
      });
    } else if (totalVol > 0 && legVol === 0 && muscleDistribution.length >= 3) {
      tips.push({
        type: 'danger',
        title: 'No entrenas piernas',
        message:
          'No hay registro de ejercicios de pierna. Sentadilla, peso muerto y prensa son fundamentales para el progreso global.',
      });
    }
  }

  // PRs recientes
  if (recentPRsCount === 0 && sessionCount30d >= 8) {
    tips.push({
      type: 'info',
      title: 'Sin records recientes',
      message:
        'No has batido ningún record en los últimos 30 días. Prueba a aumentar el peso un 2.5% en tu ejercicio principal o añadir 1 rep más.',
    });
  } else if (recentPRsCount >= 3) {
    tips.push({
      type: 'success',
      title: `${recentPRsCount} nuevos records recientes`,
      message:
        '¡Estás en racha de PRs! Tu progresión es excelente. Mantén la técnica impecable al aumentar la carga.',
    });
  }

  // Duración media
  if (avgDuration > 0 && avgDuration < 30) {
    tips.push({
      type: 'info',
      title: 'Sesiones muy cortas',
      message: `Promedio de ${avgDuration} minutos. Las sesiones ideales duran 45-75 min para un estímulo óptimo. Añade más ejercicios o series.`,
    });
  } else if (avgDuration > 120) {
    tips.push({
      type: 'warning',
      title: 'Sesiones muy largas',
      message: `Promedio de ${avgDuration} minutos. Entrenamientos de más de 2 horas pueden aumentar el cortisol. Optimiza el tiempo entre series.`,
    });
  }

  // Diversidad de ejercicios
  if (uniqueExercises < 4 && sessionCount30d >= 4) {
    tips.push({
      type: 'info',
      title: 'Poca variedad de ejercicios',
      message: `Solo ${uniqueExercises} ejercicios distintos. Añade variedad para estimular más fibras musculares y evitar adaptaciones.`,
    });
  }

  // Sin tips negativos — añadir algo positivo
  if (tips.filter((t) => t.type === 'success').length === 0 && totalWorkouts >= 10) {
    tips.push({
      type: 'success',
      title: `${totalWorkouts} entrenamientos registrados`,
      message:
        '¡Llevas mucho tiempo registrando tus entrenos! La consistencia a largo plazo es la clave del éxito.',
    });
  }

  return tips.slice(0, 6);
}

export function UserStatsPage() {
  const navigate = useNavigate();
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

  // Muscle group distribution
  const muscleDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    recentSets.forEach((s) => {
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
    recentSets.forEach((s) => {
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
        .filter((s) => {
          const d = s.workout?.started_at ? new Date(s.workout.started_at) : null;
          return d && d >= weekStart && d < weekEnd;
        })
        .reduce((sum, s) => sum + s.reps * s.weight, 0);
      return { week: `S${i + 1}`, vol, label: format(weekStart, 'dd/MM', { locale: es }) };
    });
  }, [recentSets]);

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
    () => recentSets.reduce((sum, s) => sum + s.weight * s.reps, 0),
    [recentSets],
  );

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
    ],
  );

  if (!user) {
    navigate('/login');
    return null;
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-[var(--radius-xl)] animate-pulse"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            />
          ))}
        </div>
      </Layout>
    );
  }

  const totalVol = muscleDistribution.reduce((s, m) => s + m.value, 0);

  return (
    <Layout>
      {/* Back header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-5"
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center transition-colors"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
        >
          <ArrowLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div>
          <h1 className="text-[1.0625rem] font-bold" style={{ color: 'var(--text-primary)' }}>
            Mis Estadísticas
          </h1>
          <p className="text-[0.6875rem]" style={{ color: 'var(--text-tertiary)' }}>
            Análisis completo de tu progreso
          </p>
        </div>
      </motion.div>

      <div className="space-y-5">
        {/* ── Hero KPIs ── */}
        <section className="space-y-3">
          <SectionLabel>Resumen global</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <BigKPI
              value={workouts.length}
              label="Entrenamientos totales"
              icon={Activity}
              color="#c8ff00"
              delay={0}
            />
            <BigKPI
              value={`${(totalVolumeAllTime / 1000).toFixed(0)}t`}
              label="Volumen total"
              icon={BarChart3}
              color="#3b82f6"
              delay={0.05}
            />
            <BigKPI
              value={totalPRs}
              label="Records personales"
              icon={Trophy}
              color="#fbbf24"
              delay={0.1}
            />
            <BigKPI
              value={currentStreak}
              label={`días de racha${maxStreak > currentStreak ? ` (máx. ${maxStreak})` : ''}`}
              icon={Flame}
              color="#ef4444"
              delay={0.15}
            />
          </div>

          {/* Secondary row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: sessionCount30d, label: 'sesiones/30d', color: '#22c55e' },
              { value: `${avgDuration}m`, label: 'duración media', color: '#8b5cf6' },
              { value: uniqueExercisesCount, label: 'ejercicios distintos', color: '#06b6d4' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.04 }}
                className="rounded-[var(--radius-lg)] p-3 text-center"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="font-mono font-bold text-xl" style={{ color: item.color }}>
                  {item.value}
                </div>
                <div className="text-[0.625rem] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {item.label}
                </div>
              </motion.div>
            ))}
          </div>

          {cardioTotalMin > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
              className="rounded-[var(--radius-lg)] p-3.5 flex items-center justify-between"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: '#38bdf8' }} />
                <span className="text-[0.8125rem]" style={{ color: 'var(--text-secondary)' }}>
                  Tiempo total de cardio
                </span>
              </div>
              <span className="font-mono font-semibold text-sm" style={{ color: '#38bdf8' }}>
                {cardioTotalMin >= 60
                  ? `${Math.floor(cardioTotalMin / 60)}h ${cardioTotalMin % 60}m`
                  : `${cardioTotalMin}m`}
              </span>
            </motion.div>
          )}
        </section>

        {/* ── Volumen semanal ── */}
        {weeklyVolumeData.some((w) => w.vol > 0) && (
          <section className="space-y-3">
            <SectionLabel>Evolución del volumen</SectionLabel>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
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
                    Últimas 8 semanas
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {volumeChange > 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--error)' }} />
                  )}
                  <span
                    className="text-[0.75rem] font-semibold font-mono"
                    style={{ color: volumeChange >= 0 ? 'var(--success)' : 'var(--error)' }}
                  >
                    {volumeChange > 0 ? '+' : ''}
                    {volumeChange}%
                  </span>
                </div>
              </div>
              <div className="h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyVolumeData}>
                    <defs>
                      <linearGradient id="userStatsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c8ff00" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#c8ff00" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'var(--text-tertiary)', fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide domain={[0, 'dataMax + 10']} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-surface-3)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      formatter={(v) => {
                        const n = Number(v);
                        return [n > 0 ? `${(n / 1000).toFixed(1)}t` : '0', 'Volumen'];
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="vol"
                      stroke="#c8ff00"
                      strokeWidth={2.5}
                      fill="url(#userStatsGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </section>
        )}

        {/* ── Día favorito ── */}
        {workouts.length >= 3 && (
          <section className="space-y-3">
            <SectionLabel>Consistencia por día</SectionLabel>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-[var(--radius-xl)] p-4"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              {bestDay && (
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4" style={{ color: '#fbbf24' }} />
                  <span
                    className="text-[0.8125rem] font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Tu día favorito:{' '}
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      {bestDay}
                    </span>
                  </span>
                </div>
              )}
              <div className="space-y-2.5">
                {dayFrequency.map(({ day, count, pct }, i) => (
                  <div key={day}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-[0.8125rem] w-8"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {day}
                      </span>
                      <div
                        className="flex-1 mx-3 h-2 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--bg-surface-2)' }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.45 + i * 0.04, duration: 0.5 }}
                          className="h-full rounded-full"
                          style={{
                            backgroundColor:
                              pct === 100 ? '#c8ff00' : pct > 60 ? '#22c55e' : '#3b82f6',
                          }}
                        />
                      </div>
                      <span
                        className="text-[0.75rem] font-mono w-6 text-right"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>
        )}

        {/* ── Distribución muscular ── */}
        {muscleDistribution.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Balance muscular</SectionLabel>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="rounded-[var(--radius-xl)] p-4"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4" style={{ color: 'var(--interactive-primary)' }} />
                <span
                  className="text-[0.8125rem] font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Distribución por grupo muscular
                </span>
              </div>

              {/* Pie chart */}
              <div className="h-[140px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={muscleDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={60}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {muscleDistribution.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-surface-3)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      formatter={(v) => {
                        const n = Number(v);
                        return [
                          totalVol > 0
                            ? `${(n / 1000).toFixed(1)}t (${Math.round((n / totalVol) * 100)}%)`
                            : `${v}`,
                          'Volumen',
                        ];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Horizontal bars */}
              <div className="space-y-2">
                {muscleDistribution.slice(0, 6).map(({ name, value }, i) => {
                  const pct = totalVol > 0 ? Math.round((value / totalVol) * 100) : 0;
                  return (
                    <div key={name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span
                            className="text-[0.8125rem]"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[0.6875rem] font-mono"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            {(value / 1000).toFixed(1)}t
                          </span>
                          <span
                            className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${CHART_COLORS[i % CHART_COLORS.length]}20`,
                              color: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--bg-surface-2)' }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </section>
        )}

        {/* ── Top ejercicios ── */}
        {topExercises.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Top ejercicios por volumen</SectionLabel>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-[var(--radius-xl)] overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {topExercises.map((ex, i) => {
                const maxVol = topExercises[0].volume;
                const pct = Math.round((ex.volume / maxVol) * 100);
                return (
                  <div
                    key={ex.name}
                    className="px-4 py-3"
                    style={{
                      borderBottom:
                        i < topExercises.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[0.625rem] font-bold flex-shrink-0"
                          style={{
                            backgroundColor:
                              i === 0
                                ? '#fbbf24'
                                : i === 1
                                  ? '#a3a3a3'
                                  : i === 2
                                    ? '#92400e'
                                    : 'var(--bg-surface-2)',
                            color: i < 3 ? '#000' : 'var(--text-tertiary)',
                          }}
                        >
                          {i + 1}
                        </span>
                        <span
                          className="text-[0.875rem] font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {ex.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <div
                          className="text-[0.8125rem] font-semibold font-mono"
                          style={{ color: 'var(--interactive-primary)' }}
                        >
                          {(ex.volume / 1000).toFixed(1)}t
                        </div>
                        <div className="text-[0.625rem]" style={{ color: 'var(--text-tertiary)' }}>
                          {ex.sets} series · 1RM ~{ex.best1rm.toFixed(0)}kg
                        </div>
                      </div>
                    </div>
                    <div
                      className="h-1 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'var(--bg-surface-2)' }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.55 + i * 0.05, duration: 0.5 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </section>
        )}

        {/* ── Estado muscular ── */}
        {muscleRecovery.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Estado de recuperación</SectionLabel>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="rounded-[var(--radius-xl)] p-4"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <div className="space-y-2">
                {muscleRecovery.slice(0, 6).map(({ name, daysSinceLast, status }) => {
                  const colors = {
                    fresh: { dot: '#30d158', label: 'Descansado', bg: 'rgba(48,209,88,0.1)' },
                    moderate: { dot: '#ffd60a', label: 'Moderado', bg: 'rgba(255,214,10,0.1)' },
                    'needs-attention': {
                      dot: '#ff453a',
                      label: 'Necesita trabajo',
                      bg: 'rgba(255,69,58,0.1)',
                    },
                  }[status];
                  return (
                    <div
                      key={name}
                      className="flex items-center justify-between p-2.5 rounded-[var(--radius-md)]"
                      style={{ backgroundColor: colors.bg }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: colors.dot }}
                        />
                        <span
                          className="text-[0.8125rem] font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[0.6875rem]"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          {daysSinceLast >= 0 ? `hace ${daysSinceLast}d` : 'Sin datos'}
                        </span>
                        <span
                          className="text-[0.625rem] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: colors.dot + '20', color: colors.dot }}
                        >
                          {colors.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </section>
        )}

        {/* ── Consejos ── */}
        {tips.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Consejos personalizados</SectionLabel>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="rounded-[var(--radius-xl)] p-4"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-4 h-4" style={{ color: '#ffd60a' }} />
                <span
                  className="text-[0.8125rem] font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {tips.length} consejo{tips.length !== 1 ? 's' : ''} basados en tus datos
                </span>
              </div>
              <div className="space-y-2.5">
                {tips.map((tip, i) => (
                  <TipCard key={i} tip={tip} index={i} />
                ))}
              </div>
            </motion.div>
          </section>
        )}

        {/* Sin datos */}
        {workouts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="text-5xl mb-4">📊</div>
            <div className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Sin datos todavía
            </div>
            <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Registra tus primeros entrenamientos para ver tus estadísticas aquí.
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
