import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { Layout } from '@app/components/Layout';
import { calcular1RM } from '@shared/lib/brzycki';
import { fetchExercises, fetchPersonalRecords } from '@shared/api/queries';
import confetti from 'canvas-confetti';
import { Trophy, X } from 'lucide-react';

export function WorkoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const {
    selectedExerciseId,
    customExerciseName,
    sets,
    setSelectedExercise,
    setCustomExerciseName,
    addSet,
    updateSet,
    removeSet,
    saveWorkout,
  } = useWorkoutStore();

  const { sound } = useSettingsStore();
  const { getActiveRoutine, getTodayRoutine, checkAndBackup } = useRoutineStore();

  const [message, setMessage] = useState('');
  const [customInput, setCustomInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', user?.id],
    queryFn: () => fetchExercises(user!.id),
    enabled: !!user?.id,
  });

  const { data: personalRecordsList = [] } = useQuery({
    queryKey: ['personalRecords', user?.id],
    queryFn: () => fetchPersonalRecords(user!.id),
    enabled: !!user?.id,
  });

  const personalRecords = Object.fromEntries(personalRecordsList.map((pr) => [pr.exercise_id, pr]));

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    checkAndBackup(user.id);
  }, [user, navigate, checkAndBackup]);

  const selectedExercise = exercises.find((e) => e.id === selectedExerciseId);
  const currentPR = selectedExerciseId ? personalRecords[selectedExerciseId] : null;

  const activeRoutine = getActiveRoutine();
  const todayRoutine = getTodayRoutine();

  const groups: Record<string, typeof exercises> = {};
  exercises.forEach((ex) => {
    if (!groups[ex.muscle_group]) groups[ex.muscle_group] = [];
    groups[ex.muscle_group].push(ex);
  });

  const playFeedbackSound = useCallback(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    } catch {
      // ignore audio errors
    }
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
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
      queryClient.invalidateQueries({ queryKey: ['recentSets'] });
      queryClient.invalidateQueries({ queryKey: ['personalRecords'] });

      // Lanzar confeti si hay algún PR nuevo
      const hasPR = sets.some((s) => checkIsNewPR(s.weight, s.reps));
      if (hasPR) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFFFFF', '#fafafa', '#22c55e'],
        });
      }

      setTimeout(() => setMessage(''), 2500);
      setTimeout(() => setSaveSuccess(false), 300);
    }
  };

  const handleAddSet = () => {
    addSet();
  };

  const handleRemoveSet = (index: number) => {
    removeSet(index);
  };

  const handleExerciseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const isCustom = val === '__custom__';
    setCustomInput(isCustom);
    setSelectedExercise(isCustom ? null : val || null);
    if (val && !isCustom && !sets.length) {
      addSet();
    }
  };

  const checkIsNewPR = (weight: string, reps: string): boolean => {
    if (!currentPR) return false;
    const estimated1RM = calcular1RM(Number(weight) || 0, Number(reps) || 0);
    return estimated1RM > currentPR.weight;
  };

  const bgCard = 'var(--bg-surface)';
  const border = 'var(--border-subtle)';
  const textPrimary = 'var(--text-primary)';
  const textSecondary = 'var(--text-secondary)';
  const textMuted = 'var(--text-tertiary)';
  const accent = 'var(--interactive-primary)';

  const containerVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <Layout>
      {activeRoutine && todayRoutine && todayRoutine.exercises.length > 0 && (
        <motion.div
          variants={containerVariants}
          className="mb-3 p-3 rounded-[var(--radius-lg)]"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="text-[0.8125rem] font-medium mb-1"
            style={{ color: 'var(--interactive-primary)' }}
          >
            {todayRoutine.name}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {todayRoutine.exercises.slice(0, 4).map((ex, i) => (
              <span
                key={i}
                className="text-[0.6875rem] px-2 py-1 rounded-[var(--radius-pill)]"
                style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
              >
                {ex.name}
              </span>
            ))}
            {todayRoutine.exercises.length > 4 && (
              <span className="text-[0.6875rem]" style={{ color: 'var(--text-tertiary)' }}>
                +{todayRoutine.exercises.length - 4}
              </span>
            )}
          </div>
        </motion.div>
      )}

      <motion.div
        variants={containerVariants}
        className="rounded-[var(--radius-lg)] p-4 mb-3"
        style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}
      >
        <select
          value={selectedExerciseId || (customInput ? '__custom__' : '')}
          onChange={handleExerciseChange}
          className="w-full rounded-lg text-sm p-2.5 outline-none appearance-none transition-all focus:scale-[1.01]"
          style={{ backgroundColor: bgCard, border: `1px solid ${border}`, color: textPrimary }}
        >
          <option value="">- Ejercicio -</option>
          {Object.entries(groups).map(([group, exs]) => (
            <optgroup key={group} label={group}>
              {exs.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
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
          <div className="mt-3 text-[0.85rem]" style={{ color: accent }}>
            PR: {currentPR.weight} kg × {currentPR.reps} reps
          </div>
        )}
      </motion.div>

      <motion.div
        variants={containerVariants}
        className={`rounded-[var(--radius-lg)] p-4 ${saveSuccess ? 'success-pulse' : ''}`}
        style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}
      >
        <div className="text-[0.9375rem] font-medium mb-2" style={{ color: textPrimary }}>
          {selectedExercise
            ? `Series — ${selectedExercise.name}`
            : customExerciseName
              ? `Series — ${customExerciseName}`
              : 'Series'}
        </div>

        <div
          className="flex gap-2 mb-1.5 text-[0.65rem] font-semibold uppercase"
          style={{ color: textMuted }}
        >
          <div className="w-6"></div>
          <div className="flex-1 text-center">Reps</div>
          <div className="flex-1 text-center">Kg</div>
          <div className="w-6"></div>
        </div>

        {sets.length === 0 ? (
          <div className="text-center py-8" style={{ color: textMuted }}>
            Añade una serie
          </div>
        ) : (
          sets.map((s, i) => {
            const isNewPR = checkIsNewPR(s.weight, s.reps);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2 items-center mb-2"
              >
                <div
                  className="w-6 text-center text-sm font-medium"
                  style={{ color: textSecondary }}
                >
                  {i + 1}
                </div>
                <input
                  type="number"
                  placeholder="0"
                  value={s.reps}
                  onChange={(e) => updateSet(i, { reps: e.target.value })}
                  className="flex-1 rounded-lg text-sm p-2 outline-none text-center"
                  style={{
                    backgroundColor: bgCard,
                    border: `1px solid ${border}`,
                    color: textPrimary,
                  }}
                />
                <div className="relative flex-1">
                  <input
                    type="number"
                    placeholder="0"
                    value={s.weight}
                    onChange={(e) => updateSet(i, { weight: e.target.value })}
                    className="w-full rounded-lg text-sm p-2 outline-none text-center"
                    style={{
                      backgroundColor: bgCard,
                      border: `1px solid ${border}`,
                      color: textPrimary,
                    }}
                  />
                  {isNewPR && (
                    <span className="absolute -top-1 -right-1">
                      <Trophy className="w-3 h-3" style={{ color: 'var(--interactive-primary)' }} />
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveSet(i)}
                  className="w-6 h-8 bg-transparent border rounded-lg cursor-pointer text-lg flex items-center justify-center"
                  style={{ borderColor: 'var(--border-subtle)', color: textMuted }}
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleAddSet}
            className="flex-1 py-2 px-3 border border-dashed rounded-[var(--radius-lg)] text-sm font-medium cursor-pointer"
            style={{ borderColor: border, color: textSecondary }}
          >
            + Serie
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 px-4 rounded-[var(--radius-pill)] text-[0.9375rem] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: saveSuccess ? 'var(--success)' : 'var(--interactive-primary)',
              color: 'var(--interactive-primary-fg)',
              border: 'none',
            }}
          >
            {saving ? 'Guardando...' : saveSuccess ? '✓ Listo' : 'Guardar'}
          </button>
        </div>

        {message && (
          <div
            className="mt-4 text-center text-sm"
            style={{ color: message.startsWith('✓') ? 'var(--success)' : 'var(--error)' }}
          >
            {message}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
