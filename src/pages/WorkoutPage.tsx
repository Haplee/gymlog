import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useRoutineStore } from '../stores/routineStore';
import { Layout } from '../components/Layout';
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

  const { sound } = useSettingsStore();
  const { getActiveRoutine, getTodayRoutine, checkAndBackup } = useRoutineStore();

  const [message, setMessage] = useState('');
  const [customInput, setCustomInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [inputFocus, setInputFocus] = useState<number | null>(null);
  const [newSetIndex, setNewSetIndex] = useState<number | null>(null);
  const [removingSet, setRemovingSet] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadExercises(user.id);
    loadRecentSets(user.id);
    loadPersonalRecords(user.id);
    checkAndBackup(user.id);
  }, [user, navigate, loadExercises, loadRecentSets, loadPersonalRecords, checkAndBackup]);

  const selectedExercise = exercises.find(e => e.id === selectedExerciseId);
  const currentPR = selectedExerciseId ? personalRecords[selectedExerciseId] : null;

  const activeRoutine = getActiveRoutine();
  const todayRoutine = getTodayRoutine();

  const groups: Record<string, typeof exercises> = {};
  exercises.forEach(ex => {
    if (!groups[ex.muscle_group]) groups[ex.muscle_group] = [];
    groups[ex.muscle_group].push(ex);
  });

  const playFeedbackSound = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
      
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 880;
        osc2.type = 'square';
        gain2.gain.setValueAtTime(0.5, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.2);
      }, 120);
    } catch (e) {}
  }, []);

  const handleSave = async () => {
    if (!user || saving) return;
    setMessage('');
    setSaving(true);
    const result = await saveWorkout(user.id);
    setSaving(false);
    
    if (result.error) {
      setMessage(result.error.message);
    } else {
      setSaveSuccess(true);
      if (sound) playFeedbackSound();
      setTimeout(() => setMessage(''), 2500);
      setTimeout(() => setSaveSuccess(false), 300);
    }
  };

  const handleAddSet = () => {
    const index = sets.length;
    addSet();
    setNewSetIndex(index);
    setTimeout(() => setNewSetIndex(null), 300);
  };

  const handleRemoveSet = (index: number) => {
    setRemovingSet(index);
    setTimeout(() => {
      removeSet(index);
      setRemovingSet(null);
    }, 200);
  };

  const handleExerciseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const isCustom = val === '__custom__';
    setCustomInput(isCustom);
    setSelectedExercise(isCustom ? null : val || null);
    if (val && !isCustom && !sets.length) {
      addSet();
      setNewSetIndex(0);
      setTimeout(() => setNewSetIndex(null), 300);
    }
  };

  const checkIsNewPR = (weight: string, reps: string): boolean => {
    if (!currentPR) return false;
    const estimated1RM = calcular1RM(Number(weight) || 0, Number(reps) || 0);
    return estimated1RM > currentPR.weight;
  };

  const bgCard = '#141418';
  const border = 'rgba(255,255,255,0.12)';
  const textPrimary = '#fafafa';
  const textSecondary = '#a1a1aa';
  const textMuted = '#606068';
  const accent = '#c8ff00';

  return (
    <Layout>
      {activeRoutine && todayRoutine && todayRoutine.exercises.length > 0 && (
        <div className="mb-3 p-2 rounded-lg scale-in" style={{ backgroundColor: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.2)' }}>
          <div className="text-xs font-medium mb-1" style={{ color: '#c8ff00' }}>{todayRoutine.name}</div>
          <div className="flex flex-wrap gap-1">
            {todayRoutine.exercises.slice(0, 4).map((ex, i) => (
              <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#1c1c22', color: '#a1a1aa' }}>
                {ex.name}
              </span>
            ))}
            {todayRoutine.exercises.length > 4 && (
              <span className="text-xs" style={{ color: '#606068' }}>+{todayRoutine.exercises.length - 4}</span>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl p-3 mb-3 scale-in" style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}>
        <select
          value={selectedExerciseId || (customInput ? '__custom__' : '')}
          onChange={handleExerciseChange}
          className="w-full rounded-lg text-sm p-2.5 outline-none appearance-none transition-all focus:scale-[1.01]"
          style={{ backgroundColor: bgCard, border: `1px solid ${border}`, color: textPrimary }}
        >
          <option value="">- Ejercicio -</option>
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
            placeholder="Nombre del ejercicio"
            value={customExerciseName}
            onChange={(e) => setCustomExerciseName(e.target.value)}
            className="w-full rounded-lg text-sm p-2.5 outline-none mt-2 transition-all"
            style={{ backgroundColor: bgCard, border: `1px solid ${border}`, color: textPrimary }}
          />
        )}

        {currentPR && (
          <div className="mt-3 text-[0.85rem] fade-in" style={{ color: accent }}>
            PR: {currentPR.weight} kg × {currentPR.reps} reps
          </div>
        )}
      </div>

      <div className={`rounded-xl p-3 slide-up ${saveSuccess ? 'success-pulse' : ''}`} style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}>
        <div className="text-sm font-medium mb-2" style={{ color: textPrimary }}>
          {selectedExercise ? `Series — ${selectedExercise.name}` : customExerciseName ? `Series — ${customExerciseName}` : 'Series'}
        </div>

        <div className="flex gap-2 mb-1.5 text-[0.65rem] font-semibold uppercase" style={{ color: textMuted }}>
          <div className="w-6"></div>
          <div className="flex-1 text-center">Reps</div>
          <div className="flex-1 text-center">Kg</div>
          <div className="w-6"></div>
        </div>

        {sets.length === 0 ? (
          <div className="text-center py-8 fade-in" style={{ color: textMuted }}>Añade una serie</div>
        ) : (
          sets.map((s, i) => {
            const isNewPR = checkIsNewPR(s.weight, s.reps);
            const isNew = newSetIndex === i;
            const isRemoving = removingSet === i;
            
            return (
              <div 
                key={i} 
                className={`${isNew ? 'scale-in' : ''} ${isRemoving ? 'scale-out' : ''}`}
                style={{ animationDuration: isNew || isRemoving ? '0.2s' : '0.3s' }}
              >
                <div className="flex gap-2 items-center mb-2">
                  <div className="w-6 text-center text-sm font-medium" style={{ color: textSecondary }}>{i + 1}</div>
                  <input
                    type="number"
                    placeholder="0"
                    value={s.reps}
                    onChange={(e) => updateSet(i, { reps: e.target.value })}
                    onFocus={() => setInputFocus(i * 2)}
                    onBlur={() => setInputFocus(null)}
                    className={`flex-1 rounded-lg text-sm p-2 outline-none text-center transition-all ${inputFocus === i * 2 ? 'input-focus' : ''}`}
                    style={{ 
                      backgroundColor: bgCard, 
                      border: `1px solid ${inputFocus === i * 2 ? accent : border}`, 
                      color: textPrimary,
                      boxShadow: inputFocus === i * 2 ? `0 0 0 2px ${accent}30` : 'none'
                    }}
                  />
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="0"
                      value={s.weight}
                      onChange={(e) => updateSet(i, { weight: e.target.value })}
                      onFocus={() => setInputFocus(i * 2 + 1)}
                      onBlur={() => setInputFocus(null)}
                      className={`w-full rounded-lg text-sm p-2 outline-none text-center transition-all ${inputFocus === i * 2 + 1 ? 'input-focus' : ''}`}
                      style={{ 
                        backgroundColor: bgCard, 
                        border: `1px solid ${inputFocus === i * 2 + 1 ? accent : border}`, 
                        color: textPrimary,
                        boxShadow: inputFocus === i * 2 + 1 ? `0 0 0 2px ${accent}30` : 'none'
                      }}
                    />
                    {isNewPR && (
                      <span className="absolute -top-1 -right-1 text-xs success-pulse">🏆</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveSet(i)}
                    className="w-6 h-8 bg-transparent border rounded-lg cursor-pointer text-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                    style={{ borderColor: 'rgba(255,255,255,0.06)', color: textMuted }}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleAddSet}
            className="flex-1 py-2 px-3 border border-dashed rounded-lg text-sm font-medium cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] hover:bg-[rgba(255,255,255,0.03)]"
            style={{ borderColor: border, color: textSecondary }}
          >
            + Serie
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-lg sm:rounded-xl text-sm sm:text-[1rem] font-bold cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: saveSuccess ? '#22c55e' : accent, color: '#0a0a0c', border: 'none' }}
          >
            {saving ? 'Guardando...' : saveSuccess ? '✓ Listo' : 'Guardar'}
          </button>
        </div>

        {message && (
          <div className={`mt-4 text-center text-sm error-shake`} style={{ color: message.startsWith('✓') ? accent : '#ff5252' }}>
            {message}
          </div>
        )}
      </div>
    </Layout>
  );
}
