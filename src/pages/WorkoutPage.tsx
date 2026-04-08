import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { Layout } from '../components/Layout';
import { RestTimer } from '../components/RestTimer';

export function WorkoutPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    exercises, 
    selectedExerciseId, 
    customExerciseName, 
    sets,
    loadExercises, 
    loadRecentSets,
    setSelectedExercise, 
    setCustomExerciseName,
    addSet,
    updateSet,
    removeSet,
    saveWorkout 
  } = useWorkoutStore();
  
  const [message, setMessage] = useState('');
  const [customInput, setCustomInput] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadExercises();
    loadRecentSets(user.id);
  }, [user, navigate, loadExercises, loadRecentSets]);

  const selectedExercise = exercises.find(e => e.id === selectedExerciseId);

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
      </div>

      <RestTimer />

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 slide-up">
        <div className="text-[1.1rem] font-semibold mb-3">
          {selectedExercise ? `Series — ${selectedExercise.name}` : customExerciseName ? `Series — ${customExerciseName}` : 'Series'}
        </div>
        
        <div className="grid grid-cols-[36px_1fr_80px_40px] gap-2 mb-2 text-[0.75rem] font-semibold text-[#606068] uppercase">
          <div></div>
          <div>Reps</div>
          <div>Kg</div>
          <div></div>
        </div>
        
        {sets.length === 0 ? (
          <div className="text-center py-8 text-[#606068]">Añade una serie</div>
        ) : (
          sets.map((s, i) => (
            <div key={i} className="grid grid-cols-[36px_1fr_80px_40px] gap-2 items-center mb-2">
              <div className="text-center text-[#a0a0a8] font-semibold">{i + 1}</div>
              <input
                type="number"
                placeholder="reps"
                value={s.reps}
                onChange={(e) => updateSet(i, { reps: e.target.value })}
                className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-xl text-white text-[1.1rem] p-3 outline-none"
              />
              <input
                type="number"
                placeholder="kg"
                value={s.weight}
                onChange={(e) => updateSet(i, { weight: e.target.value })}
                className="bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-xl text-white text-[1.1rem] p-3 outline-none"
              />
              <button
                onClick={() => removeSet(i)}
                className="w-10 h-10 bg-transparent border border-[rgba(255,255,255,0.06)] text-[#606068] rounded-xl cursor-pointer text-xl flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))
        )}
        
        <div className="flex gap-3 mt-4">
          <button
            onClick={addSet}
            className="flex-1 py-3 px-4 bg-transparent border border-dashed border-[rgba(255,255,255,0.12)] text-[#a0a0a8] rounded-xl text-[1rem] font-semibold cursor-pointer"
          >
            + serie
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 px-4 bg-[#c8ff00] text-[#0a0a0c] border-none rounded-xl text-[1rem] font-bold cursor-pointer"
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
