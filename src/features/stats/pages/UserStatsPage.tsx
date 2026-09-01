import { generateTips } from '@features/stats/utils/tips';
import { useAutoregulation } from '@features/stats/hooks/useAutoregulation';
import { buildDeloadInput, suggestDeload } from '../utils/autoregulation';
import { NextSessionCard } from '@features/stats/components/NextSessionCard';
import { DeloadCard } from '../components/userStats/DeloadCard';
import { celebrate } from '@shared/lib/celebration';
import { useMemo, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
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
import { calculateMuscleGroupDistribution } from '../utils/statsData';
import { useExerciseMusclesMap } from '../hooks/useExerciseMusclesMap';
import { useWeight } from '@shared/hooks/useWeight';
import { comparePeriods } from '../utils/periodComparison';
import { projectNextVolume } from '../utils/volumeProjection';
import { useTranslation } from 'react-i18next';
import { computeAchievements } from '@shared/lib/achievements';
import { toast } from 'sonner';
import { format, subWeeks, startOfWeek, eachWeekOfInterval, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { calcular1RM } from '@shared/lib/brzycki';
import { onlyRepSets } from '@shared/lib/setShape';
import { SectionLabel } from '../components/userStats/SectionLabel';
import { BigKPI } from '../components/userStats/BigKPI';
import { TipCard } from '../components/userStats/TipCard';
import { MuscleRecovery } from '../components/userStats/MuscleRecovery';
import { MuscleMap } from '../components/MuscleMap';
import { WorkoutCalendar } from '../components/userStats/WorkoutCalendar';
import { DayFrequencyChart } from '../components/userStats/DayFrequencyChart';
import { TopExercisesList } from '../components/userStats/TopExercisesList';
import { BodyMeasurements } from '../components/userStats/BodyMeasurements';
import { WearablesSummary } from '@features/wearables/components/WearablesSummary';
import { PageHeader } from '@shared/components/ui';
import {
  Activity,
  Calendar,
  ChartBar,
  Clock,
  Dumbbell,
  Flame,
  Lightbulb,
  Medal,
  Trophy,
  Weight,
  type IconComponent,
} from '@shared/components/icons';

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
  return <div className="h-56 skeleton rounded-card" aria-hidden="true" />;
}

export function UserStatsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const cardioSessions = useCardioStore((s) => s.sessions);
  const syncCardio = useCardioStore((s) => s.syncFromRemote);

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

  /**
   * Solo las series que se miden en repeticiones. Ver la nota equivalente en
   * `StatsPage`: volumen, 1RM y reparto muscular no saben qué hacer con una
   * serie por tiempo. Hoy no descarta nada.
   */
  const strengthSets = useMemo(() => onlyRepSets(recentSets), [recentSets]);
  // Sugerencias de carga a partir del RIR/RPE ya registrado. Local y gratis:
  // se muestran tenga o no activado el entrenador IA.
  const nextSessionAdvice = useAutoregulation(strengthSets);

  // Semana de descarga: volumen y RIR agregados por semana ISO (productor puro)
  // y la regla del motor determinista. null si aún no hay 3 semanas de datos.
  const deloadSuggestion = useMemo(() => {
    // Solo series de fuerza: una plancha no puede disparar una semana de
    // descarga de press banca (design.md §4.3). Hoy no descarta nada.
    const input = buildDeloadInput(workouts.map((w) => ({ ...w, sets: onlyRepSets(w.sets) })));
    return input ? suggestDeload(input) : null;
  }, [workouts]);

  const currentStreak = useMemo(() => calculateCurrentStreak(workouts), [workouts]);
  const maxStreak = useMemo(() => calculateMaxStreak(workouts), [workouts]);
  const weeklyVolume = useMemo(() => calculateWeeklyVolume(strengthSets), [strengthSets]);
  const prevWeekVolume = useMemo(() => calculatePreviousWeekVolume(strengthSets), [strengthSets]);
  const volumeChange = useMemo(
    () => calculateVolumeChangePercent(weeklyVolume, prevWeekVolume),
    [weeklyVolume, prevWeekVolume],
  );
  const sessionCount30d = useMemo(() => calculateSessionCountLast30Days(workouts), [workouts]);
  const daysSinceLast = useMemo(() => getDaysSinceLastWorkout(workouts), [workouts]);
  const avgDuration = useMemo(() => calculateAverageSessionDuration(workouts), [workouts]);
  const totalPRs = useMemo(() => calculateAllTimePRsCount(personalRecords), [personalRecords]);
  const musclesMap = useExerciseMusclesMap();
  // Volúmenes en la unidad del usuario (kg→t, lb→k lb), no toneladas fijas.
  const { formatVol } = useWeight();
  // Aquí van TODAS las series, no solo las de repeticiones. La recuperación no
  // es una medida de volumen sino de recencia —cuántos días hace que se tocó ese
  // músculo— y una plancha trabaja el core igual que un crunch. Filtrarla con
  // `strengthSets` dejaba a la app diciendo que el core llevaba una semana
  // descansando el día después de una sesión entera de planchas. El aviso de
  // «hoy toca X» (`useFatigueSuggestion`) ya usaba las series sin filtrar: esto
  // hace que las dos digan lo mismo.
  const muscleRecovery = useMemo(
    () => analyzeMuscleRecovery(recentSets, musclesMap),
    [recentSets, musclesMap],
  );
  const periodComparison = useMemo(() => comparePeriods(strengthSets, 30), [strengthSets]);

  // Muscle group distribution (reparto ponderado entre los músculos del ejercicio)
  const muscleDistribution = useMemo(
    () => calculateMuscleGroupDistribution(strengthSets, musclesMap),
    [strengthSets, musclesMap],
  );

  // Top exercises by volume
  const topExercises = useMemo(() => {
    const byEx: Record<string, { volume: number; sets: number; best1rm: number }> = {};
    strengthSets.filter(isWorkingSet).forEach((s) => {
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
  }, [strengthSets]);

  // Weekly volume last 8 weeks
  const weeklyVolumeData = useMemo(() => {
    const now = new Date();
    const start = subWeeks(now, 8);
    const weekStarts = eachWeekOfInterval({ start, end: now }).map((w) =>
      startOfWeek(w, { weekStartsOn: 1 }),
    );
    return weekStarts.map((weekStart, i) => {
      const weekEnd = subDays(weekStart, -7);
      const vol = strengthSets
        .filter(isWorkingSet)
        .filter((s) => {
          const d = s.workout?.started_at ? new Date(s.workout.started_at) : null;
          return d && d >= weekStart && d < weekEnd;
        })
        .reduce((sum, s) => sum + s.reps * s.weight, 0);
      return { week: `S${i + 1}`, vol, label: format(weekStart, 'dd/MM', { locale: es }) };
    });
  }, [strengthSets]);

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
    () => strengthSets.filter(isWorkingSet).reduce((sum, s) => sum + s.weight * s.reps, 0),
    [strengthSets],
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
    const SEEN_KEY = 'gymlog-achievements-seen:v1';
    const unlocked = achievements.flatMap((a) => (a.unlocked ? [a.id] : []));
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw === null) {
      localStorage.setItem(SEEN_KEY, JSON.stringify(unlocked));
      return;
    }
    let seen: string[] = [];
    try {
      seen = JSON.parse(raw);
    } catch {
      seen = [];
    }
    const seenSet = new Set(seen);
    const fresh = unlocked.filter((id) => !seenSet.has(id));
    if (fresh.length) {
      fresh.forEach((id) =>
        toast.success(`${t('achievements.unlocked_toast')} ${t(`achievements.${id}`)}`),
      );
      celebrate();
      localStorage.setItem(SEEN_KEY, JSON.stringify(unlocked));
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
            <div className="skeleton w-11 h-11 rounded-md" />
            <div className="skeleton h-5 w-40 rounded-card" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-28 rounded-card" />
            ))}
          </div>
          <div className="skeleton h-56 rounded-card" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={t('userStats.page_title')}
        subtitle={t('userStats.page_subtitle')}
        onBack={() => navigate(-1)}
        backLabel={t('common.back')}
        className="mb-5"
      />

      <div className="space-y-5">
        {/* ── Qué hacer ahora ──
            Va lo primero, y antes iba en los puestos 13 y 14 de quince
            secciones: la descarga y la próxima sesión son lo único de esta
            pantalla sobre lo que se puede actuar hoy, y estaban por detrás de
            los logros, las medidas, el wearable y cinco gráficos. El resumen y
            los gráficos siguen debajo, que es donde se consultan. */}
        {(nextSessionAdvice.length > 0 || deloadSuggestion?.recommended) && (
          <section className="space-y-3">
            <SectionLabel>{t('userStats.what_now')}</SectionLabel>
            {deloadSuggestion?.recommended && <DeloadCard suggestion={deloadSuggestion} />}
            <div className="space-y-2">
              {nextSessionAdvice.map((advice) => (
                <NextSessionCard key={advice.exercise} advice={advice} />
              ))}
            </div>
          </section>
        )}

        {/* ── Hero KPIs ── */}
        <section className="space-y-3">
          <SectionLabel>{t('userStats.global_summary')}</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <BigKPI
              value={workouts.length}
              label={t('userStats.total_workouts')}
              icon={Activity}
              delay={0}
            />
            <BigKPI
              value={formatVol(totalVolumeAllTime)}
              label={t('userStats.total_volume')}
              icon={ChartBar}
              delay={0.05}
            />
            <BigKPI value={totalPRs} label={t('userStats.total_prs')} icon={Trophy} delay={0.1} />
            <BigKPI
              value={currentStreak}
              label={
                t('userStats.streak_days', { count: currentStreak }) +
                (maxStreak > currentStreak
                  ? t('userStats.streak_max_suffix', { max: maxStreak })
                  : '')
              }
              icon={Flame}
              delay={0.15}
            />
          </div>

          {/* Secondary row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                value: sessionCount30d,
                label: t('userStats.sessions_30d'),
              },
              {
                value: `${avgDuration}m`,
                label: t('userStats.avg_duration'),
              },
              {
                value: uniqueExercisesCount,
                label: t('userStats.distinct_exercises'),
              },
            ].map((item, i) => (
              <m.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.04 }}
                className="rounded-card p-3 bg-surface border border-line shadow-card"
              >
                {/* Dato con regla vertical a la izquierda, como el "75 Kg /
                    Weight" de la cabecera Progress Tracking del kit. */}
                <div className="flex items-stretch gap-2">
                  <span
                    aria-hidden="true"
                    className="w-1 flex-shrink-0 rounded-pill bg-line-interactive"
                  />
                  <div className="min-w-0">
                    <div className="font-display font-bold text-xl tabular text-fg">
                      {item.value}
                    </div>
                    <div className="text-2xs mt-0.5 text-fg-subtle">{item.label}</div>
                  </div>
                </div>
              </m.div>
            ))}
          </div>

          <SectionLabel>{t('userStats.calendar_title')}</SectionLabel>
          <WorkoutCalendar workouts={workouts} />

          {cardioTotalMin > 0 && (
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-card p-3.5 flex items-center justify-between bg-surface border border-line"
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
              const ACH_ICONS: Record<string, IconComponent> = {
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
                  className={`rounded-card p-3 flex items-center gap-3 border shadow-card ${
                    a.unlocked
                      ? 'bg-surface border-line-accent'
                      : 'bg-surface border-line opacity-60'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${
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

        {/* ── Wearables (sueño / pasos / FC) ── */}
        <WearablesSummary />

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
                    {formatVol(stats.volume)}
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
              {t('userStats.volume_pct', { pct: periodComparison.volumeChangePct })}
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
                    {formatVol(volumeProjection.projected)}
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
        {/* El mapa va justo antes de la lista y con el mismo dato: responde
            «¿qué me falta por entrenar?» de un vistazo, y la lista de debajo da
            el detalle en días. Uno no sustituye a la otra. */}
        <MuscleMap recovery={muscleRecovery} />
        <MuscleRecovery muscleRecovery={muscleRecovery} />

        {/* ── Descarga, cuando no toca ──
            Se conserva a propósito: saber que el entrenador vigila el volumen y
            el esfuerzo vale, pero no vale el primer pantallazo. Cuando sí toca,
            sube arriba con lo accionable. */}
        {deloadSuggestion && !deloadSuggestion.recommended && (
          <section className="space-y-3">
            <SectionLabel>{t('coach.kind.deload')}</SectionLabel>
            <DeloadCard suggestion={deloadSuggestion} />
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
                  {t('userStats.tips_count', { count: tips.length })}
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
            <ChartBar className="mx-auto mb-4 h-12 w-12 text-accent" />
            <div className="text-base font-semibold mb-2 text-fg">{t('userStats.empty_title')}</div>
            <div className="text-sm text-fg-subtle">{t('userStats.empty_desc')}</div>
          </m.div>
        )}
      </div>
    </Layout>
  );
}
