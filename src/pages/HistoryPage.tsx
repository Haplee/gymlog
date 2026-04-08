import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { shareWorkout } from '../lib/share';
import type { WorkoutWithSets } from '../lib/types';

interface GroupedWorkout {
  date: string;
  workouts: WorkoutWithSets[];
  totalSets: number;
  totalVolume: number;
}

export function HistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { recentSets, loadRecentSets, workouts, loadWorkouts, repeatWorkout } = useWorkoutStore();
  const [view, setView] = useState<'sets' | 'workouts'>('sets');
  const [filterExercise, setFilterExercise] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    Promise.all([
      loadRecentSets(user.id),
      loadWorkouts(user.id),
      useWorkoutStore.getState().loadExercises(user.id)
    ]).then(() => setLoading(false));
  }, [user, navigate, loadRecentSets, loadWorkouts]);

  const handleRepeat = (workout: WorkoutWithSets) => {
    repeatWorkout(workout);
    navigate('/');
  };

  const exercises = [...new Set(recentSets.map(s => s.exercise?.name).filter(Boolean))];

  const filteredSets = recentSets
    .filter(s => !filterExercise || s.exercise?.name === filterExercise)
    .sort((a, b) => new Date(b.workout?.started_at).getTime() - new Date(a.workout?.started_at).getTime())
    .slice(0, 30);

  const groupedWorkouts: GroupedWorkout[] = workouts.reduce((acc: GroupedWorkout[], wo) => {
    const date = new Date(wo.started_at).toLocaleDateString();
    const existing = acc.find(g => g.date === date);
    const volume = wo.sets.reduce((sum, s) => sum + (s.reps * s.weight), 0);
    if (existing) {
      existing.workouts.push(wo);
      existing.totalSets += wo.sets.length;
      existing.totalVolume += volume;
    } else {
      acc.push({ date, workouts: [wo], totalSets: wo.sets.length, totalVolume: volume });
    }
    return acc;
  }, []);

  const handleDelete = async (id: string) => {
    await supabase.from('workout_sets').delete().eq('id', id);
    if (user) loadRecentSets(user.id);
    setDeleteId(null);
  };

  const exportToExcel = () => {
    const data = filteredSets.map(s => ({
      ejercicio: s.exercise?.name || '',
      fecha: s.workout?.started_at ? new Date(s.workout.started_at).toISOString().split('T')[0] : '',
      peso: s.weight,
      reps: s.reps,
    }));

    const allDates = new Set<string>();
    data.forEach(row => {
      if (row.fecha) allDates.add(row.fecha);
    });
    allDates.add(new Date().toISOString().split('T')[0]);

    const sortedDates = Array.from(allDates).sort().reverse();
    
    let csv = '';
    
    sortedDates.forEach(date => {
      const parts = date.split('-');
      const dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
      
      csv += `Tren superior,${dateFormatted},\n`;
      
      const dayData = data.filter(r => r.fecha === date);
      
      if (dayData.length === 0) {
        csv += `Bíceps,"no hay registros",\n`;
      } else {
        const exercises = dayData.map(r => r.ejercicio).sort();
        exercises.forEach(exName => {
          const row = dayData.find(r => r.ejercicio === exName);
          if (row) {
            csv += `${row.ejercicio},,${row.peso}\n`;
          }
        });
      }
      
      csv += '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gymlog_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const importFromCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) {
      setToast('Error: Selecciona un archivo e inicia sesión');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const validExtensions = ['.csv', '.txt'];
    const fileName = file.name.toLowerCase();
    if (!validExtensions.some(ext => fileName.endsWith(ext))) {
      setToast('Error: Formato no válido');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        
        if (!text || text.trim().length === 0) {
          setToast('El archivo está vacío');
          setTimeout(() => setToast(null), 3000);
          return;
        }

        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        
        if (lines.length < 2) {
          setToast('El archivo no tiene suficientes datos');
          setTimeout(() => setToast(null), 3000);
          return;
        }

        setToast('Cargando...');
        await useWorkoutStore.getState().loadExercises(user.id);
        await new Promise(resolve => setTimeout(resolve, 500));
        const exerciseList = useWorkoutStore.getState().exercises;
        
        const getExerciseId = async (name: string): Promise<string | null> => {
          const cleanName = name.replace(/["']/g, '').trim();
          if (!cleanName || cleanName.length < 2) return null;
          
          const existing = exerciseList.find(ex => 
            ex && ex.name && ex.name.toLowerCase() === cleanName.toLowerCase()
          );
          
          if (existing?.id) return existing.id;
          
          try {
            const { data: newEx, error } = await supabase
              .from('exercises')
              .insert({ 
                name: cleanName, 
                user_id: user.id, 
                muscle_group: 'Importado' 
              })
              .select('id')
              .single();
            
            if (error || !newEx) return null;
            
            exerciseList.push({ id: newEx.id, name: cleanName, muscle_group: 'Importado', user_id: user.id, created_at: '' });
            return newEx.id;
          } catch (e) {
            return null;
          }
        };

        const parseNumber = (val: string | undefined): number | null => {
          if (!val) return null;
          
          let cleaned = val.replace(/["']/g, '').trim();
          if (cleaned === '' || cleaned === '-' || cleaned.toLowerCase() === 'no') return null;
          
          cleaned = cleaned.replace(/\s+/g, ' ').replace(/[a-zA-Z]/g, ' ').replace(/[^\d,.\-]/g, '').replace(/,/g, '.');
          
          const match = cleaned.match(/^(\d+\.?\d*)/);
          if (!match) return null;
          
          const num = parseFloat(match[1]);
          return (!isNaN(num) && num > 0 && num < 1000) ? Math.round(num * 10) / 10 : null;
        };

        const parseDate = (dateStr: string): string | null => {
          if (!dateStr || dateStr.trim() === '' || !dateStr.includes('/')) return null;
          
          const parts = dateStr.split('/');
          if (parts.length !== 3) return null;
          
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);
          
          if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
          
          const fullYear = year < 100 ? 2000 + year : year;
          const finalYear = fullYear > 2026 ? fullYear - 100 : fullYear;
          
          if (day < 1 || day > 31 || month < 1 || month > 12) return null;
          
          return `${finalYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        };

        const isHeaderLine = (firstCol: string): boolean => {
          const lower = firstCol.toLowerCase();
          const headers = [
            'tren superior', 'tren inferior', 'pecho', 'espalda', 'hombro',
            'multiarticulares', 'isquio', 'femoral', 'abductores', 'adductores',
            'cuádriceps', 'gemelos', 'tibiales', 'bíceps', 'tríceps', 'piernas',
            'brazo', 'espalda baja', 'glúteos', 'core', 'abdomen'
          ];
          return headers.some(h => lower.includes(h));
        };

        let imported = 0;
        let errors: string[] = [];
        const dateWorkoutMap: Record<string, string> = {};
        let currentDate = new Date().toISOString().split('T')[0];
        
        for (let i = 0; i < lines.length; i++) {
          const lineNum = i + 1;
          const line = lines[i];
          
          if (line.length > 1000) continue;
          
          let cols: string[] = [];
          let inQuotes = false;
          let current = '';
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              cols.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          cols.push(current.trim());
          
          while (cols.length < 3) cols.push('');
          
          const firstCol = cols[0].trim();
          const secondCol = cols[1]?.trim() || '';
          const thirdCol = cols[2]?.trim() || '';
          
          if (isHeaderLine(firstCol)) {
            const parsedDate = parseDate(secondCol) || parseDate(thirdCol);
            if (parsedDate) currentDate = parsedDate;
            continue;
          }
          
          if (!firstCol || firstCol.length < 2) continue;
          
          const skipPhrases = ['no hay registros', 'sin registros', 'sin datos', 'descanso', 'libre'];
          if (skipPhrases.some(p => secondCol.toLowerCase().includes(p))) continue;
          
          const peso = parseNumber(secondCol) || parseNumber(thirdCol);
          
          if (!peso) continue;
          
          if (!dateWorkoutMap[currentDate]) {
            const { data: workoutData, error: woError } = await supabase
              .from('workouts')
              .insert({ user_id: user.id, started_at: currentDate })
              .select('id')
              .single();
            
            if (woError || !workoutData) {
              errors.push(`Fila ${lineNum}: Error creando entrenamiento`);
              continue;
            }
            
            dateWorkoutMap[currentDate] = workoutData.id;
          }
          
          const exerciseId = await getExerciseId(firstCol);
          
          if (!exerciseId) {
            errors.push(`Fila ${lineNum}: "${firstCol}" no se pudo crear`);
            continue;
          }
          
          const { error: insertError } = await supabase.from('workout_sets').insert({
            workout_id: dateWorkoutMap[currentDate],
            exercise_id: exerciseId,
            weight: peso,
            reps: 10,
            set_num: 1
          });
          
          if (insertError) continue;
          
          imported++;
        }
        
        if (imported > 0) {
          await loadRecentSets(user.id);
          await loadWorkouts(user.id);
        }
        
        let message = imported > 0 
          ? `Importados: ${imported}` 
          : 'No se pudieron importar';
        
        if (errors.length > 0) message += ` (${errors.length} errores)`;
        
        setToast(message);
        setTimeout(() => setToast(null), 3000);
        
      } catch (err) {
        console.error('Import error:', err);
        setToast('Error inesperado');
        setTimeout(() => setToast(null), 3000);
      }
    };
    
    reader.onerror = () => {
      setToast('Error al leer el archivo');
      setTimeout(() => setToast(null), 3000);
    };
    
    reader.readAsText(file);
    e.target.value = '';
  };

  if (loading) {
    return (
      <Layout>
        <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
          <div className="skeleton h-12 w-full"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex gap-2 mb-3 flex-wrap">
        <select
          value={view}
          onChange={(e) => setView(e.target.value as 'sets' | 'workouts')}
          className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] text-[0.95rem] p-2 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <option value="sets">Series</option>
          <option value="workouts">Entrenos</option>
        </select>
        
        {view === 'sets' && (
          <>
            <select
              value={filterExercise}
              onChange={(e) => setFilterExercise(e.target.value)}
              className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] text-[0.95rem] p-2 cursor-pointer transition-all hover:scale-[1.02]"
            >
              <option value="">Todos</option>
              {exercises.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
            <button
              onClick={exportToExcel}
              className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-lg text-[#c8ff00] text-[0.95rem] px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Exportar
            </button>
            <label className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] text-[0.95rem] px-3 py-2 cursor-pointer font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]">
              Importar
              <input type="file" accept=".csv,.txt" onChange={importFromCsv} className="hidden" />
            </label>
          </>
        )}
      </div>

      {view === 'sets' ? (
        <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden scale-in">
          {filteredSets.length === 0 ? (
            <div className="text-center py-8 text-[#606068] fade-in">Sin registros</div>
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
                  <tr key={s.id} className="fade-in">
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
                        className="bg-transparent border-none cursor-pointer text-xl transition-all hover:scale-125"
                        style={{ color: '#606068' }}
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
      ) : (
        <div className="space-y-3">
          {groupedWorkouts.length === 0 ? (
            <div className="text-center py-8 text-[#606068] fade-in">Sin registros</div>
          ) : (
            groupedWorkouts.map((group, gi) => (
              <div key={gi} className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden scale-in" style={{ animationDelay: `${gi * 0.1}s` }}>
                <div className="p-3 border-b border-[rgba(255,255,255,0.06)] flex justify-between items-center">
                  <span className="font-semibold text-white">{group.date}</span>
                  <span className="text-[#606068] text-[0.85rem]">{group.totalSets} series · {group.totalVolume.toLocaleString()} kg</span>
                </div>
                {group.workouts.map((wo) => (
                  <div key={wo.id} className="p-3 border-b border-[rgba(255,255,255,0.06)] last:border-b-0">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[#a0a0a8] text-[0.9rem]">
                        {new Date(wo.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRepeat(wo)}
                          className="text-[#c8ff00] text-[0.8rem] font-semibold bg-transparent border-none cursor-pointer transition-all hover:scale-105"
                        >
                          Repetir
                        </button>
                        <button
                          onClick={async () => {
                            const uniqueExercises = [...new Set(wo.sets.map(s => s.exercise?.name))].length;
                            const volume = wo.sets.reduce((sum, s) => sum + (s.reps * s.weight), 0);
                            const success = await shareWorkout({
                              exerciseCount: uniqueExercises,
                              totalSets: wo.sets.length,
                              totalVolume: volume,
                              date: new Date(wo.started_at).toLocaleDateString()
                            });
                            setToast(success ? '✓ Compartido' : 'Error');
                            setTimeout(() => setToast(null), 2000);
                          }}
                          className="text-[#a0a0a8] text-[0.8rem] font-semibold bg-transparent border-none cursor-pointer transition-all hover:scale-105"
                        >
                          Compartir
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {wo.sets.map((s, si) => (
                        <span key={si} className="bg-[#1c1c22] px-2 py-1 rounded-lg text-[0.8rem] text-[#a0a0a8]">
                          {s.exercise?.name}: {s.reps}×{s.weight}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/90 z-200 flex items-center justify-center p-4 fade-in">
          <div className="bg-[#1c1c22] border border-[rgba(255,255,255,0.12)] rounded-2xl p-6 max-w-[320px] w-full scale-in">
            <div className="text-[1.3rem] font-bold mb-2">¿Eliminar?</div>
            <div className="text-[#a0a0a8] mb-4">Esta acción no se puede deshacer</div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="py-2 px-4 bg-transparent border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] cursor-pointer font-semibold transition-all hover:scale-[1.02]"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="py-2 px-4 bg-transparent border border-[#ff5252] rounded-lg text-[#ff5252] cursor-pointer font-semibold transition-all hover:scale-[1.02]"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1c1c22] border border-[rgba(255,255,255,0.12)] text-white px-4 py-2 rounded-lg text-[0.9rem] z-300 scale-in">
          {toast}
        </div>
      )}
    </Layout>
  );
}
