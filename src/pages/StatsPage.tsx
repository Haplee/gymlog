import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { Layout } from '../components/Layout';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function StatsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { recentSets, loadRecentSets } = useWorkoutStore();
  const [rmWeight, setRmWeight] = useState('');
  const [rmReps, setRmReps] = useState('');
  const [rmResult, setRmResult] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadRecentSets(user.id);
  }, [user, navigate, loadRecentSets]);

  const uniqueExs = [...new Set(recentSets.map(s => s.exercise?.name))].length;
  const totalVol = recentSets.reduce((a, s) => a + (s.reps * s.weight), 0);
  const totalSets = recentSets.length;
  const uniqueDays = [...new Set(recentSets.map(s => new Date(s.workout?.started_at).toDateString()))].length;

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

  const calcRM = () => {
    const w = parseFloat(rmWeight);
    const r = parseInt(rmReps);
    if (w && r) {
      const rm = w / (1.0278 - (0.0278 * r));
      setRmResult(rm);
    } else {
      setRmResult(null);
    }
  };

  return (
    <Layout>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-center slide-up">
          <div className="text-[1.6rem] font-extrabold text-[#c8ff00]">{uniqueDays}</div>
          <div className="text-[0.75rem] text-[#606068] uppercase font-semibold">Días</div>
        </div>
        <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-center slide-up">
          <div className="text-[1.6rem] font-extrabold text-[#c8ff00]">{totalSets}</div>
          <div className="text-[0.75rem] text-[#606068] uppercase font-semibold">Series</div>
        </div>
        <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-center slide-up">
          <div className="text-[1.6rem] font-extrabold text-[#c8ff00]">{(totalVol / 1000).toFixed(1)}t</div>
          <div className="text-[0.75rem] text-[#606068] uppercase font-semibold">Volumen</div>
        </div>
        <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-center slide-up">
          <div className="text-[1.6rem] font-extrabold text-[#c8ff00]">{uniqueExs}</div>
          <div className="text-[0.75rem] text-[#606068] uppercase font-semibold">Ejercicios</div>
        </div>
      </div>

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-4 slide-up">
        <div className="text-[1.1rem] font-semibold mb-3">Esta semana</div>
        {totalSets === 0 ? (
          <div className="text-center py-8 text-[#606068]">Sin datos</div>
        ) : (
          <div className="h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="label" tick={{ fill: '#606068', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ background: '#1c1c22', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }}
                  labelStyle={{ color: '#a0a0a8' }}
                />
                <Bar dataKey="vol" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
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

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 slide-up">
        <div className="text-[1.1rem] font-semibold mb-3">Calculadora 1RM (Brzycki)</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[0.85rem] font-semibold text-[#a0a0a8] mb-2">Peso (kg)</div>
            <input
              type="number"
              placeholder="100"
              value={rmWeight}
              onChange={(e) => { setRmWeight(e.target.value); calcRM(); }}
              className="w-full bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-xl text-white text-[1.1rem] p-3 outline-none"
            />
          </div>
          <div>
            <div className="text-[0.85rem] font-semibold text-[#a0a0a8] mb-2">Reps</div>
            <input
              type="number"
              placeholder="10"
              value={rmReps}
              onChange={(e) => { setRmReps(e.target.value); calcRM(); }}
              className="w-full bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-xl text-white text-[1.1rem] p-3 outline-none"
            />
          </div>
        </div>
        <div className="mt-4 text-[1.2rem] font-extrabold text-[#c8ff00] text-center">
          1RM: {rmResult ? `${rmResult.toFixed(1)} kg` : '-- kg'}
        </div>
        <div className="text-center text-[#606068] text-[0.7rem] mt-1">Fórmula: Peso / (1.0278 - (0.0278 * Reps))</div>
      </div>
    </Layout>
  );
}
