import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useSettingsStore } from '../stores/settingsStore';
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

  const { vibration, sound } = useSettingsStore();

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
      if (vibration) {
        triggerVibration([100, 50, 100, 50, 200, 50, 300]);
      }
      if (sound) {
        playFeedbackSound();
      }
      setTimeout(() => setMessage(''), 2500);
    }
  };

  const triggerVibration = (pattern: number[]) => {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        console.warn('[Vibration] Error:', e);
      }
    }
  };

  const playFeedbackSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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

  const bgCard = '#141418';
  const border = 'rgba(255,255,255,0.12)';
  const textPrimary = '#fafafa';
  const textSecondary = '#a1a1aa';
  const textMuted = '#606068';
  const accent = '#c8ff00';

  return (
    <Layout>
      <div className="rounded-xl p-3 mb-3 slide-up" style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}>
        <select
          value={selectedExerciseId || (customInput ? '__custom__' : '')}
          onChange={handleExerciseChange}
          className="w-full rounded-lg text-sm p-2.5 outline-none appearance-none"
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
            className="w-full rounded-lg text-sm p-2.5 outline-none mt-2"
            style={{ backgroundColor: bgCard, border: `1px solid ${border}`, color: textPrimary }}
          />
        )}

        {currentPR && (
          <div className="mt-3 text-[0.85rem]" style={{ color: accent }}>
            🏆 PR: {currentPR.weight} kg × {currentPR.reps} reps
          </div>
        )}
      </div>

      <RestTimer />

      <div className="rounded-xl p-3 slide-up" style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}>
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
          <div className="text-center py-8" style={{ color: textMuted }}>Añade una serie</div>
        ) : (
          sets.map((s, i) => {
            const isNewPR = checkIsNewPR(s.weight, s.reps);
            return (
              <div key={i}>
                <div className="flex gap-2 items-center mb-2">
                  <div className="w-6 text-center text-sm font-medium" style={{ color: textSecondary }}>{i + 1}</div>
                  <input
                    type="number"
                    placeholder="0"
                    value={s.reps}
                    onChange={(e) => updateSet(i, { reps: e.target.value })}
                    className="flex-1 rounded-lg text-sm p-2 outline-none text-center"
                    style={{ backgroundColor: bgCard, border: `1px solid ${border}`, color: textPrimary }}
                  />
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="0"
                      value={s.weight}
                      onChange={(e) => updateSet(i, { weight: e.target.value })}
                      className="w-full rounded-lg text-sm p-2 outline-none text-center"
                      style={{ backgroundColor: bgCard, border: `1px solid ${border}`, color: textPrimary }}
                    />
                    {isNewPR && (
                      <span className="absolute -top-1 -right-1 text-xs">🏆</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeSet(i)}
                    className="w-6 h-8 bg-transparent border rounded-lg cursor-pointer text-lg flex items-center justify-center"
                    style={{ borderColor: 'rgba(255,255,255,0.06)', color: textMuted }}
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
                    className="w-full rounded-xl text-[0.9rem] p-2 outline-none mb-2"
                    style={{ backgroundColor: bgCard, border: `1px solid ${border}`, color: textSecondary }}
                  />
                )}

                <button
                  onClick={() => toggleNotes(i)}
                  className="text-[0.75rem] bg-transparent border-none cursor-pointer mb-3"
                  style={{ color: textMuted }}
                >
                  {expandedNotes.includes(i) ? '▲ ocultar notas' : '▼ añadir nota'}
                </button>
              </div>
            );
          })
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={addSet}
            className="flex-1 py-2 px-3 border border-dashed rounded-lg text-sm font-medium cursor-pointer"
            style={{ borderColor: border, color: textSecondary }}
          >
            + Serie
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-lg sm:rounded-xl text-sm sm:text-[1rem] font-bold cursor-pointer"
            style={{ backgroundColor: accent, color: '#0a0a0c', border: 'none' }}
          >
            Guardar
          </button>
        </div>

        {message && (
          <div className={`mt-4 text-center text-sm`} style={{ color: message.startsWith('✓') ? accent : '#ff5252' }}>
            {message}
          </div>
        )}
      </div>
    </Layout>
  );
}
