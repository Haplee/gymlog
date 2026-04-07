import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';

export function HistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { recentSets, loadRecentSets } = useWorkoutStore();
  const [filterExercise, setFilterExercise] = useState('');
  const [sortCol, setSortCol] = useState('date');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadRecentSets(user.id);
  }, [user, navigate, loadRecentSets]);

  const exercises = [...new Set(recentSets.map(s => s.exercise?.name).filter(Boolean))];

  const filteredSets = recentSets
    .filter(s => !filterExercise || s.exercise?.name === filterExercise)
    .sort((a, b) => {
      if (sortCol === 'date') {
        return new Date(b.workout?.started_at).getTime() - new Date(a.workout?.started_at).getTime();
      }
      return (a.exercise?.name || '').localeCompare(b.exercise?.name || '');
    })
    .slice(0, 30);

  const handleDelete = async (id: string) => {
    await supabase.from('workout_sets').delete().eq('id', id);
    if (user) loadRecentSets(user.id);
    setDeleteId(null);
  };

  return (
    <Layout>
      <div className="flex gap-2 mb-3 flex-wrap">
        <select
          value={filterExercise}
          onChange={(e) => setFilterExercise(e.target.value)}
          className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] text-[0.95rem] p-2 cursor-pointer"
        >
          <option value="">todos</option>
          {exercises.map(ex => (
            <option key={ex} value={ex}>{ex}</option>
          ))}
        </select>
        <select
          value={sortCol}
          onChange={(e) => setSortCol(e.target.value)}
          className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] text-[0.95rem] p-2 cursor-pointer"
        >
          <option value="date">recientes</option>
          <option value="exercise">ejercicio</option>
        </select>
      </div>

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
        {filteredSets.length === 0 ? (
          <div className="text-center py-8 text-[#606068]">Sin registros</div>
        ) : (
          <table className="w-full text-[0.95rem]">
            <thead>
              <tr>
                <th className="bg-[#141418] p-3 text-left text-[0.75rem] font-semibold text-[#606068] uppercase border-b border-[rgba(255,255,255,0.06)]">Fecha</th>
                <th className="bg-[#141418] p-3 text-left text-[0.75rem] font-semibold text-[#606068] uppercase border-b border-[rgba(255,255,255,0.06)]">Ejercicio</th>
                <th className="bg-[#141418] p-3 text-left text-[0.75rem] font-semibold text-[#606068] uppercase border-b border-[rgba(255,255,255,0.06)]">S</th>
                <th className="bg-[#141418] p-3 text-left text-[0.75rem] font-semibold text-[#606068] uppercase border-b border-[rgba(255,255,255,0.06)]">Kg</th>
                <th className="bg-[#141418] p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredSets.map(s => (
                <tr key={s.id}>
                  <td className="p-3 border-b border-[rgba(255,255,255,0.06)] text-[#606068] text-[0.85rem]">
                    {s.workout?.started_at ? new Date(s.workout.started_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="p-3 border-b border-[rgba(255,255,255,0.06)] font-semibold">
                    {s.exercise?.name}
                  </td>
                  <td className="p-3 border-b border-[rgba(255,255,255,0.06)] text-[#606068] text-[0.85rem]">
                    {s.set_num}
                  </td>
                  <td className="p-3 border-b border-[rgba(255,255,255,0.06)] text-[#c8ff00] font-bold">
                    {s.weight}
                  </td>
                  <td className="p-3 border-b border-[rgba(255,255,255,0.06)]">
                    <button
                      onClick={() => setDeleteId(s.id)}
                      style={{ background: 'none', border: 'none', color: '#606068', cursor: 'pointer', fontSize: '1.2rem' }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteId && (
        <div className="fixed inset-0 bg-black/90 z-200 flex items-center justify-center p-4">
          <div className="bg-[#1c1c22] border border-[rgba(255,255,255,0.12)] rounded-2xl p-6 max-w-[320px] w-full">
            <div className="text-[1.3rem] font-bold mb-2">¿Eliminar?</div>
            <div className="text-[#a0a0a8] mb-4">Esta acción no se puede deshacer</div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="py-2 px-4 bg-transparent border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] cursor-pointer font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="py-2 px-4 bg-transparent border border-[#ff5252] rounded-lg text-[#ff5252] cursor-pointer font-semibold"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
