import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useWakeLock } from '../hooks/useWakeLock';
import { Layout } from '../components/Layout';
import { RestTimer } from '../components/RestTimer';
import { calcular1RM } from '../lib/brzycki';

export function WorkoutPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    exercises, 
    selectedExerciseId, 
    customExerciseName, 
    sets,
    personalRecords,
    loadExercises, 
    loadRecentSets,
    loadPersonalRecords,
    setSelectedExercise, 
    setCustomExerciseName,
    addSet,
    updateSet,
    removeSet,
    saveWorkout 
  } = useWorkoutStore();
  
  const [message, setMessage] = useState('');
  const [customInput, setCustomInput] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<number[]>([]);

  useWakeLock(sets.length > 0);

  const toggleNotes = (index: number) => {
    setExpandedNotes(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadExercises(user.id);
    loadRecentSets(user.id);
    loadPersonalRecords(user.id);
  }, [user, navigate, loadExercises, loadRecentSets, loadPersonalRecords]);

  const selectedExercise = exercises.find(e => e.id === selectedExerciseId);
  const currentPR = selectedExerciseId ? personalRecords[selectedExerciseId] : null;

  const groups: Record<string, typeof exercises> = {};
  exercises.forEach(ex => {
    if (!groups[ex.muscle_group]) groups[ex.muscle_group] = [];
    groups[ex.muscle_group].push(ex);
  });

  const handleSave = async () => {
    if (!user) return;
    setMessage('');
    const result = await saveWorkout(user.id);
    if (result.error) {
      setMessage(result.error.message);
    } else {
      setMessage('✓ Entreno guardado');
      setTimeout(() => setMessage(''), 2500);
    }
  };

  const handleExerciseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const isCustom = val === '__custom__';
    setCustomInput(isCustom);
    setSelectedExercise(isCustom ? null : val || null);
    if (val && !isCustom && !sets.length) addSet();
  };

  const checkIsNewPR = (weight: string, reps: string): boolean => {
    if (!currentPR) return false;
    const estimated1RM = calcular1RM(Number(weight) || 0, Number(reps) || 0);
    return estimated1RM > currentPR.weight;
  };

  return (
    <Layout>
      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-4 slide-up">
        <select
          value={selectedExerciseId || (customInput ? '__custom__' : '')}
          onChange={handleExerciseChange}
          className="w-full bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-xl text-white text-[1.1rem] p-4 outline-none appearance-none"
        >
          <option value="">— ejercicio —</option>
          {Object.entries(groups).map(([group, exs]) => (
            <optgroup key={group} label={group}>
              {exs.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </optgroup>
          ))}
          <option value="__custom__">+ Personalizado</option>
        </select>
        
        {customInput && (
          <input
            type="text"
            placeholder="ejercicio"
            value={customExerciseName}
            onChange={(e) => setCustomExerciseName(e.target.value)}
            className="w-full bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-xl text-white text-[1.1rem] p-4 outline-none mt-4"
          />
        )}
        
        {currentPR && (
          <div className="mt-3 text-[0.85rem] text-[#c8ff00]">
            🏆 PR: {currentPR.weight} kg × {currentPR.reps} reps
          </div>
        )}
      </div>

      <RestTimer />

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 slide-up">
        <div className="text-[1.1rem] font-semibold mb-3">
          {selectedExercise ? `Series — ${selectedExercise.name}` : customExerciseName ? `Series — ${customExerciseName}` : 'Series'}
        </div>
        
        <div className="grid grid-cols-[32px_1fr_1fr_36px] gap-1 sm:gap-2 mb-2 text-[0.7rem] sm:text-[0.75rem] font-semibold text-[#606068] uppercase">
          <div></div>
          <div>Reps</div>
          <div>Kg</div>
          <div></div>
        </div>
        
        {sets.length === 0 ? (
          <div className="text-center py-8 text-[#606068]">Añade una serie</div>
        ) : (
          sets.map((s, i) => {
            const isNewPR = checkIsNewPR(s.weight, s.reps);
            return (
              <div key={i}>
                <div className="grid grid-cols-[32px_1fr_1fr_36px] gap-1 sm:gap-2 items-center mb-2">
                  <div className="text-center text-[#a0a0a8] font-semibold text-sm">{i + 1}</div>
                  <input
                    type="number"
                    placeholder="reps"
                    value={s.reps}
                    onChange={(e) => updateSet(i, { reps: e.target.value })}
                    className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-lg sm:rounded-xl text-white text-base sm:text-[1.1rem] p-2 sm:p-3 outline-none"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="kg"
                      value={s.weight}
                      onChange={(e) => updateSet(i, { weight: e.target.value })}
                      className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-lg sm:rounded-xl text-white text-base sm:text-[1.1rem] p-2 sm:p-3 outline-none w-full"
                    />
                    {isNewPR && (
                      <span className="absolute -top-1 -right-1 text-[0.65rem] sm:text-[0.7rem]">🏆</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeSet(i)}
                    className="w-8 h-8 sm:w-10 sm:h-10 bg-transparent border border-[rgba(255,255,255,0.06)] text-[#606068] rounded-lg sm:rounded-xl cursor-pointer text-lg sm:text-xl flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
                
                {expandedNotes.includes(i) && (
                  <input
                    type="text"
                    placeholder="fallo muscular, asistido..."
                    value={s.notes || ''}
                    onChange={(e) => updateSet(i, { notes: e.target.value })}
                    className="w-full bg-[#141418] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#a0a0a8] text-[0.9rem] p-2 outline-none mb-2"
                  />
                )}
                
                <button
                  onClick={() => toggleNotes(i)}
                  className="text-[#606068] text-[0.75rem] bg-transparent border-none cursor-pointer mb-3"
                >
                  {expandedNotes.includes(i) ? '▲ ocultar notas' : '▼ añadir nota'}
                </button>
              </div>
            );
          })
        )}
        
        <div className="flex gap-2 sm:gap-3 mt-4">
          <button
            onClick={addSet}
            className="flex-1 py-2 sm:py-3 px-3 sm:px-4 bg-transparent border border-dashed border-[rgba(255,255,255,0.12)] text-[#a0a0a8] rounded-lg sm:rounded-xl text-sm sm:text-[1rem] font-semibold cursor-pointer"
          >
            + serie
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 sm:py-3 px-3 sm:px-4 bg-[#c8ff00] text-[#0a0a0c] border-none rounded-lg sm:rounded-xl text-sm sm:text-[1rem] font-bold cursor-pointer"
          >
            Guardar
          </button>
        </div>
        
        {message && (
          <div className={`mt-4 text-center text-sm ${message.startsWith('✓') ? 'text-[#c8ff00]' : 'text-[#ff5252]'}`}>
            {message}
          </div>
        )}
      </div>
    </Layout>
  );
}