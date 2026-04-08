import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { Layout } from '../components/Layout';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, subWeeks, startOfWeek, eachWeekOfInterval, parseISO } from 'date-fns';

interface ExerciseStats {
  name: string;
  maxWeight: number;
  date: string;
}

export function StatsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { recentSets, loadRecentSets, loadWorkouts, workouts } = useWorkoutStore();
  const [rmWeight, setRmWeight] = useState('');
  const [rmReps, setRmReps] = useState('');
  const [rmResult, setRmResult] = useState<number | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadRecentSets(user.id).then(() => setLoading(false));
    loadWorkouts(user.id);
  }, [user, navigate, loadRecentSets, loadWorkouts]);

  useEffect(() => {
    if (recentSets.length === 0) return;
    
    const uniqueExs = [...new Set(recentSets.map(s => s.exercise?.name).filter(Boolean))];
    if (uniqueExs.length > 0 && !selectedExercise) {
      setSelectedExercise(uniqueExs[0]);
    }
  }, [recentSets]);

  useEffect(() => {
    if (!selectedExercise || recentSets.length === 0) return;

    const exerciseSets = recentSets
      .filter(s => s.exercise?.name === selectedExercise)
      .sort((a, b) => new Date(a.workout?.started_at).getTime() - new Date(b.workout?.started_at).getTime());

    const stats: ExerciseStats[] = [];
    const byDate: Record<string, number> = {};

    exerciseSets.forEach(s => {
      const date = new Date(s.workout?.started_at).toISOString().split('T')[0];
      if (!byDate[date] || s.weight > byDate[date]) {
        byDate[date] = s.weight;
      }
    });

    Object.entries(byDate).forEach(([date, maxWeight]) => {
      stats.push({ name: selectedExercise, maxWeight, date });
    });

    setExerciseStats(stats);
  }, [selectedExercise, recentSets]);

  useEffect(() => {
    if (workouts.length === 0) return;

    const dates = workouts
      .map(w => new Date(w.started_at).toISOString().split('T')[0])
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
      .reverse();

    let current = 0;
    let max = 0;
    let temp = 0;
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < dates.length; i++) {
      const diff = i === 0 ? 0 : (new Date(dates[i - 1]).getTime() - new Date(dates[i]).getTime()) / (1000 * 60 * 60 * 24);
      
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

    setCurrentStreak(current);
    setMaxStreak(max);
  }, [workouts]);

  const totalVol = recentSets.reduce((a, s) => a + (s.reps * s.weight), 0);
  const totalSets = recentSets.length;

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());

  const chartData = Array(7).fill(0).map((_, i) => ({ label: days[i], vol: 0 }));

  recentSets.forEach(s => {
    const d = new Date(s.workout?.started_at);
    if (d >= weekStart) {
      chartData[d.getDay()].vol += s.reps * s.weight;
    }
  });

  const weeklyVolume = () => {
    const weeks = eachWeekOfInterval({
      start: subWeeks(now, 7),
      end: now
    }).map(w => startOfWeek(w));

    return weeks.map((weekStart, i) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      let vol = 0;
      recentSets.forEach(s => {
        const d = new Date(s.workout?.started_at);
        if (d >= weekStart && d <= weekEnd) {
          vol += s.reps * s.weight;
        }
      });

      return {
        week: `S${i + 1}`,
        vol
      };
    }).reverse();
  };

  const calcRM = (weight: string, reps: string) => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (w && r) {
      setRmResult(w / (1.0278 - 0.0278 * r));
    } else {
      setRmResult(null);
    }
  };

  const exerciseOptions = [...new Set(recentSets.map(s => s.exercise?.name).filter(Boolean))];

  if (loading) {
    return (
      <Layout>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-xl p-3">
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
        <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-center scale-in" style={{ animationDelay: '0.1s' }}>
          <div className="text-[1.6rem] font-extrabold text-[#c8ff00]">{maxStreak}</div>
          <div className="text-[0.75rem] text-[#606068] uppercase font-semibold">Racha máxima</div>
        </div>
        <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-center scale-in" style={{ animationDelay: '0.2s' }}>
          <div className="text-[1.6rem] font-extrabold text-[#c8ff00]">{totalSets}</div>
          <div className="text-[0.75rem] text-[#606068] uppercase font-semibold">Series</div>
        </div>
        <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-center scale-in" style={{ animationDelay: '0.3s' }}>
          <div className="text-[1.6rem] font-extrabold text-[#c8ff00]">{(totalVol / 1000).toFixed(1)}t</div>
          <div className="text-[0.75rem] text-[#606068] uppercase font-semibold">Volumen</div>
        </div>
      </div>

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-4 scale-in" style={{ animationDelay: '0.1s' }}>
        <div className="text-[1.1rem] font-semibold mb-3">Esta semana</div>
        {totalSets === 0 ? (
          <div className="text-center py-8 text-[#606068] fade-in">Sin datos</div>
        ) : (
          <div className="h-[100px] fade-in">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="label" tick={{ fill: '#606068', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#1c1c22', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }}
                  labelStyle={{ color: '#a0a0a8' }}
                />
                <Bar dataKey="vol" fill="url(#barGradient)" radius={[4, 4, 0, 0]} animationDuration={800} />
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

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-4 scale-in" style={{ animationDelay: '0.2s' }}>
        <div className="text-[1.1rem] font-semibold mb-3">Volumen semanal</div>
        {totalSets === 0 ? (
          <div className="text-center py-8 text-[#606068] fade-in">Sin datos</div>
        ) : (
          <div className="h-[120px] fade-in">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVolume()}>
                <XAxis dataKey="week" tick={{ fill: '#606068', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#1c1c22', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }}
                  labelStyle={{ color: '#a0a0a8' }}
                  formatter={(value) => [`${Number(value).toLocaleString()} kg`, 'Volumen']}
                />
                <Bar dataKey="vol" fill="url(#barGradient2)" radius={[4, 4, 0, 0]} animationDuration={800} />
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

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-4 scale-in" style={{ animationDelay: '0.3s' }}>
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
              {exerciseOptions.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
            {exerciseStats.length < 2 ? (
              <div className="text-center py-4 text-[#606068] fade-in">Necesitas al menos 2 sesiones</div>
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
                      contentStyle={{ background: '#1c1c22', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }}
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

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 scale-in" style={{ animationDelay: '0.4s' }}>
        <div className="text-[1.1rem] font-semibold mb-3">Calculadora 1RM</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[0.85rem] font-semibold text-[#a0a0a8] mb-2">Peso (kg)</div>
            <input
              type="number"
              placeholder="100"
              value={rmWeight}
              onChange={(e) => { setRmWeight(e.target.value); calcRM(e.target.value, rmReps); }}
              className="w-full bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-xl text-white text-[1.1rem] p-3 outline-none transition-all"
            />
          </div>
          <div>
            <div className="text-[0.85rem] font-semibold text-[#a0a0a8] mb-2">Reps</div>
            <input
              type="number"
              placeholder="10"
              value={rmReps}
              onChange={(e) => { setRmReps(e.target.value); calcRM(rmWeight, e.target.value); }}
              className="w-full bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-xl text-white text-[1.1rem] p-3 outline-none transition-all"
            />
          </div>
        </div>
        <div className="mt-4 text-[1.2rem] font-extrabold text-[#c8ff00] text-center success-pulse">
          1RM: {rmResult ? `${rmResult.toFixed(1)} kg` : '-- kg'}
        </div>
        <div className="text-center text-[#606068] text-[0.7rem] mt-1">Fórmula: Brzycki</div>
      </div>
    </Layout>
  );
}
