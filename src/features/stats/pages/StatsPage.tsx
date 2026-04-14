import { useState, useMemo, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import { Layout } from '@app/components/Layout';
import { format, subWeeks, startOfWeek, eachWeekOfInterval, parseISO } from 'date-fns';
import { fetchWorkoutsAndSets } from '@shared/api/queries';
import { calcular1RM } from '@shared/lib/brzycki';
import { EmptyStats } from '@shared/components/EmptyStates';

const BarChart = lazy(() => import('recharts').then((m) => ({ default: m.BarChart })));
const Bar = lazy(() => import('recharts').then((m) => ({ default: m.Bar })));
const XAxis = lazy(() => import('recharts').then((m) => ({ default: m.XAxis })));
const YAxis = lazy(() => import('recharts').then((m) => ({ default: m.YAxis })));
const Tooltip = lazy(() => import('recharts').then((m) => ({ default: m.Tooltip })));
const ResponsiveContainer = lazy(() =>
  import('recharts').then((m) => ({ default: m.ResponsiveContainer })),
);
const LineChart = lazy(() => import('recharts').then((m) => ({ default: m.LineChart })));
const Line = lazy(() => import('recharts').then((m) => ({ default: m.Line })));
const RadarChart = lazy(() => import('recharts').then((m) => ({ default: m.RadarChart })));
const Radar = lazy(() => import('recharts').then((m) => ({ default: m.Radar })));
const PolarGrid = lazy(() => import('recharts').then((m) => ({ default: m.PolarGrid })));
const PolarAngleAxis = lazy(() => import('recharts').then((m) => ({ default: m.PolarAngleAxis })));

interface ExerciseStats {
  name: string;
  maxWeight: number;
  date: string;
}

export function StatsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [rmWeight, setRmWeight] = useState('');
  const [rmReps, setRmReps] = useState('');
  const [rmResult, setRmResult] = useState<number | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['workoutsAndSets', user?.id],
    queryFn: () => fetchWorkoutsAndSets(user!.id),
    enabled: !!user?.id,
  });

  const workouts = data?.workouts || [];
  const recentSets = data?.sets || [];

  const loading = isLoading;

  const uniqueExs = useMemo(() => {
    return [...new Set(recentSets.map((s) => s.exercise?.name).filter(Boolean))] as string[];
  }, [recentSets]);

  const activeExercise = selectedExercise || (uniqueExs.length > 0 ? uniqueExs[0] : '');

  const exerciseStats = useMemo(() => {
    if (!activeExercise || recentSets.length === 0) return [];

    const exerciseSets = recentSets
      .filter((s) => s.exercise?.name === activeExercise)
      .sort(
        (a, b) =>
          new Date(a.workout?.started_at).getTime() - new Date(b.workout?.started_at).getTime(),
      );

    const stats: ExerciseStats[] = [];
    const byDate: Record<string, number> = {};

    exerciseSets.forEach((s) => {
      const date = new Date(s.workout?.started_at).toISOString().split('T')[0];
      if (!byDate[date] || s.weight > byDate[date]) {
        byDate[date] = s.weight;
      }
    });

    Object.entries(byDate).forEach(([date, maxWeight]) => {
      stats.push({ name: activeExercise, maxWeight, date });
    });

    return stats;
  }, [activeExercise, recentSets]);

  const { currentStreak, maxStreak } = useMemo(() => {
    if (workouts.length === 0) return { currentStreak: 0, maxStreak: 0 };

    const dates = workouts
      .map((w) => new Date(w.started_at).toISOString().split('T')[0])
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
      .reverse();

    let current = 0;
    let max = 0;
    let temp = 0;
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < dates.length; i++) {
      const diff =
        i === 0
          ? 0
          : (new Date(dates[i - 1]).getTime() - new Date(dates[i]).getTime()) /
            (1000 * 60 * 60 * 24);

      if (diff === 1 || (i === 0 && dates[0] === today)) {
        temp++;
        if (i === 0 || dates[0] === today) current = temp;
      } else {
        max = Math.max(max, temp);
        temp = 1;
      }
    }
    max = Math.max(max, temp);
    if (dates[0] === today) current = temp;

    return { currentStreak: current, maxStreak: max };
  }, [workouts]);

  const radarData = useMemo(() => {
    if (!recentSets || recentSets.length === 0) return [];

    const muscleVolumes: Record<string, number> = {};
    recentSets.forEach((set) => {
      const mg = set.exercise?.muscle_group || 'Otro';
      muscleVolumes[mg] = (muscleVolumes[mg] || 0) + set.weight * set.reps;
    });

    return Object.entries(muscleVolumes).map(([subject, A]) => ({
      subject,
      A,
    }));
  }, [recentSets]);

  const totalVol = useMemo(
    () => recentSets.reduce((a, s) => a + s.reps * s.weight, 0),
    [recentSets],
  );
  const totalSets = recentSets.length;

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const now = new Date();
  const weekStart = useMemo(() => {
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay());
    return d;
  }, [now]);

  const chartData = useMemo(() => {
    const data = Array(7)
      .fill(0)
      .map((_, i) => ({ label: days[i], vol: 0 }));

    recentSets.forEach((s) => {
      const d = new Date(s.workout?.started_at);
      if (d >= weekStart) {
        data[d.getDay()].vol += s.reps * s.weight;
      }
    });
    return data;
  }, [recentSets, weekStart, days]);

  const weeklyVolume = useMemo(() => {
    const weeks = eachWeekOfInterval({
      start: subWeeks(now, 7),
      end: now,
    }).map((w) => startOfWeek(w));

    return weeks
      .map((weekStart2, i) => {
        const weekEnd = new Date(weekStart2);
        weekEnd.setDate(weekEnd.getDate() + 6);

        let vol = 0;
        recentSets.forEach((s) => {
          const d = new Date(s.workout?.started_at);
          if (d >= weekStart2 && d <= weekEnd) {
            vol += s.reps * s.weight;
          }
        });

        return {
          week: `S${i + 1}`,
          vol,
        };
      })
      .reverse();
  }, [recentSets, now]);

  const calcRM = (weight: string, reps: string) => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (w && r) {
      setRmResult(calcular1RM(w, r));
    } else {
      setRmResult(null);
    }
  };

  const exerciseOptions = [...new Set(recentSets.map((s) => s.exercise?.name).filter(Boolean))];

  if (!user) {
    navigate('/login');
    return null;
  }

  if (loading) {
    return (
      <Layout>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-xl p-3"
            >
              <div className="skeleton h-8 w-16 rounded mb-2"></div>
              <div className="skeleton h-3 w-20 rounded"></div>
            </div>
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-center scale-in">
          <div className="text-[1.6rem] font-extrabold text-[#c8ff00]">{currentStreak}</div>
          <div className="text-[0.75rem] text-[#606068] uppercase font-semibold">Racha actual</div>
        </div>
        <div
          className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-center scale-in"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="text-[1.6rem] font-extrabold text-[#c8ff00]">{maxStreak}</div>
          <div className="text-[0.75rem] text-[#606068] uppercase font-semibold">Racha máxima</div>
        </div>
        <div
          className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-center scale-in"
          style={{ animationDelay: '0.2s' }}
        >
          <div className="text-[1.6rem] font-extrabold text-[#c8ff00]">{totalSets}</div>
          <div className="text-[0.75rem] text-[#606068] uppercase font-semibold">Series</div>
        </div>
        <div
          className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-center scale-in"
          style={{ animationDelay: '0.3s' }}
        >
          <div className="text-[1.6rem] font-extrabold text-[#c8ff00]">
            {(totalVol / 1000).toFixed(1)}t
          </div>
          <div className="text-[0.75rem] text-[#606068] uppercase font-semibold">Volumen</div>
        </div>
      </div>

      <div
        className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-4 scale-in"
        style={{ animationDelay: '0.1s' }}
      >
        <div className="text-[1.1rem] font-semibold mb-3">Esta semana</div>
        {totalSets === 0 ? (
          <div className="text-center py-8 text-[#606068] fade-in">Sin datos</div>
        ) : (
          <div className="h-[100px] fade-in">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#606068', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: '#1c1c22',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: '#a0a0a8' }}
                />
                <Bar
                  dataKey="vol"
                  fill="url(#barGradient)"
                  radius={[4, 4, 0, 0]}
                  animationDuration={800}
                />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c8ff00" />
                    <stop offset="100%" stopColor="rgba(200,255,0,0.5)" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div
        className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-4 scale-in"
        style={{ animationDelay: '0.2s' }}
      >
        <div className="text-[1.1rem] font-semibold mb-3">Volumen semanal</div>
        {totalSets === 0 ? (
          <div className="text-center py-8 text-[#606068] fade-in">Sin datos</div>
        ) : (
          <div className="h-[120px] fade-in">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVolume}>
                <XAxis
                  dataKey="week"
                  tick={{ fill: '#606068', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: '#1c1c22',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: '#a0a0a8' }}
                  formatter={(value) => [`${Number(value).toLocaleString()} kg`, 'Volumen']}
                />
                <Bar
                  dataKey="vol"
                  fill="url(#barGradient2)"
                  radius={[4, 4, 0, 0]}
                  animationDuration={800}
                />
                <defs>
                  <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c8ff00" />
                    <stop offset="100%" stopColor="rgba(200,255,0,0.5)" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div
        className="bg-[--bg-surface] border border-[--border-default] rounded-[--radius-2xl] p-4 mb-4 scale-in"
        style={{ animationDelay: '0.25s' }}
      >
        <div className="text-[--text-lg] font-semibold text-[--text-primary] mb-3">
          Distribución muscular
        </div>
        {radarData.length === 0 ? (
          <EmptyStats />
        ) : (
          <div className="h-[220px] fade-in">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="var(--border-strong)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  formatter={(value) => [`${Number(value).toLocaleString()} kg`, 'Volumen']}
                />
                <Radar
                  name="Volumen"
                  dataKey="A"
                  stroke="var(--color-primary)"
                  fill="var(--color-primary)"
                  fillOpacity={0.4}
                  animationDuration={800}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div
        className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-4 scale-in"
        style={{ animationDelay: '0.3s' }}
      >
        <div className="text-[1.1rem] font-semibold mb-3">Progresión</div>
        {exerciseOptions.length === 0 ? (
          <div className="text-center py-8 text-[#606068] fade-in">Sin datos</div>
        ) : (
          <>
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="w-full bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-xl text-white text-[1rem] p-3 outline-none mb-4 transition-all focus:scale-[1.01]"
            >
              {exerciseOptions.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
            {exerciseStats.length < 2 ? (
              <div className="text-center py-4 text-[#606068] fade-in">
                Necesitas al menos 2 sesiones
              </div>
            ) : (
              <div className="h-[150px] fade-in">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={exerciseStats}>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#606068', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => format(parseISO(v), 'dd/MM')}
                    />
                    <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip
                      contentStyle={{
                        background: '#1c1c22',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: '#a0a0a8' }}
                      formatter={(value) => [`${Number(value)} kg`, 'Peso máx']}
                    />
                    <Line
                      type="monotone"
                      dataKey="maxWeight"
                      stroke="#c8ff00"
                      strokeWidth={2}
                      dot={{ fill: '#c8ff00', strokeWidth: 0, r: 4 }}
                      animationDuration={800}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>

      <div
        className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 scale-in"
        style={{ animationDelay: '0.4s' }}
      >
        <div className="text-[1.1rem] font-semibold mb-3">Calculadora 1RM</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[0.85rem] font-semibold text-[#a0a0a8] mb-2">Peso (kg)</div>
            <input
              type="number"
              placeholder="100"
              value={rmWeight}
              onChange={(e) => {
                setRmWeight(e.target.value);
                calcRM(e.target.value, rmReps);
              }}
              className="w-full bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-xl text-white text-[1.1rem] p-3 outline-none transition-all"
            />
          </div>
          <div>
            <div className="text-[0.85rem] font-semibold text-[#a0a0a8] mb-2">Reps</div>
            <input
              type="number"
              placeholder="10"
              value={rmReps}
              onChange={(e) => {
                setRmReps(e.target.value);
                calcRM(rmWeight, e.target.value);
              }}
              className="w-full bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-xl text-white text-[1.1rem] p-3 outline-none transition-all"
            />
          </div>
        </div>
        <div className="mt-4 text-[1.2rem] font-extrabold text-[#c8ff00] text-center success-pulse">
          1RM: {rmResult ? `${rmResult.toFixed(1)} kg` : '-- kg'}
        </div>
      </div>
    </Layout>
  );
}
