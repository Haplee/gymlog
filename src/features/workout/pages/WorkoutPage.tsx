import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { Layout } from '@app/components/Layout';
import { calcular1RM } from '@shared/lib/brzycki';
import {
  fetchExercises,
  fetchPersonalRecords,
  fetchExerciseNotes,
  saveExerciseNote,
  deleteExerciseNote,
  deleteExercise,
} from '@shared/api/queries';
import confetti from 'canvas-confetti';
import { Trophy, X, Trash2, Plus, StickyNote, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { notify } from '@shared/lib/notifications';
import { impact, notificationHaptic, ImpactStyle, NotificationType } from '@shared/lib/haptics';

const setSchema = z.object({
  reps: z.coerce.number().positive('Las repeticiones deben ser mayores a 0'),
  weight: z.coerce.number().nonnegative('El peso no puede ser negativo'),
});

// Componente extraído fuera para evitar el error react-hooks/static-components
function ResumeWorkoutBanner({
  onContinue,
  onDiscard,
}: {
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mb-4 p-4 rounded-xl border-2 border-[--color-primary] bg-[--color-primary]/5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2 text-[--color-primary]">
        <AlertCircle className="w-5 h-5" />
        <span className="font-semibold text-sm">{t('workout.resume_banner')}</span>
      </div>
      <p className="text-xs text-[--text-secondary]">
        {t('workout.resume_desc')}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onContinue}
          className="flex-1 py-2 rounded-lg bg-[--color-primary] text-[--interactive-primary-fg] text-xs font-bold"
        >
          {t('workout.continue')}
        </button>
        <button
          onClick={onDiscard}
          className="flex-1 py-2 rounded-lg border border-[--border-default] text-[--text-secondary] text-xs font-medium"
        >
          {t('workout.discard')}
        </button>
      </div>
    </motion.div>
  );
}

export function WorkoutPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const {
    activeExerciseId,
    customExerciseName,
    sets,
    startedAt,
    setActiveExercise,
    setCustomExerciseName,
    addSet,
    updateSet,
    removeSet,
    removeAllSets,
    saveWorkout,
    clearPersistedState,
  } = useWorkoutStore();

  const { sound } = useSettingsStore();
  const { getActiveRoutine, getTodayRoutine, checkAndBackup } = useRoutineStore();

  const [message, setMessage] = useState('');
  const [customInput, setCustomInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [setErrors, setSetErrors] = useState<Record<number, string>>({});
  const [showResumeBanner, setShowResumeBanner] = useState(() => {
    if (startedAt && sets.length > 0) {
      const startTime = new Date(startedAt).getTime();
      const now = new Date().getTime();
      const twelveHours = 12 * 60 * 60 * 1000;
      return now - startTime < twelveHours;
    }
    return false;
  });

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', user?.id],
    queryFn: () => fetchExercises(user?.id ?? ''),
    enabled: !!user?.id,
  });

  const { data: personalRecordsList = [] } = useQuery({
    queryKey: ['personalRecords', user?.id],
    queryFn: () => fetchPersonalRecords(user?.id ?? ''),
    enabled: !!user?.id,
  });

  const { data: exerciseNotes = [], refetch: refetchNotes } = useQuery({
    queryKey: ['exerciseNotes', user?.id, activeExerciseId],
    queryFn: () => fetchExerciseNotes(user?.id ?? '', activeExerciseId ?? ''),
    enabled: !!user?.id && !!activeExerciseId,
  });

  const personalRecords = Object.fromEntries(personalRecordsList.map((pr) => [pr.exercise_id, pr]));

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    checkAndBackup(user.id);

    // Bloque 1: Si el workout es viejo, limpiarlo al montar
    if (startedAt && sets.length > 0) {
      const startTime = new Date(startedAt).getTime();
      const now = new Date().getTime();
      const twelveHours = 12 * 60 * 60 * 1000;
      if (now - startTime >= twelveHours) {
        clearPersistedState();
      }
    }
  }, [user, navigate, checkAndBackup, startedAt, sets.length, clearPersistedState]);

  const selectedExercise = exercises.find((e) => e.id === activeExerciseId);
  const currentPR = activeExerciseId ? personalRecords[activeExerciseId] : null;

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

    setSetErrors({});

    // Bloque 6: Filtrado y Validación con Zod
    const newErrors: Record<number, string> = {};
    let hasValid = false;

    sets.forEach((s, i) => {
      // Ignorar completamente series vacías (las borramos/filtramos lógicamente)
      if ((s.reps === '' || s.reps === '0') && (s.weight === '' || s.weight === '0')) {
        return;
      }

      const validation = setSchema.safeParse(s);
      if (!validation.success) {
        newErrors[i] = validation.error.errors[0]?.message || 'Inválido';
      } else {
        hasValid = true;
      }
    });

    setSetErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      void notificationHaptic(NotificationType.Error);
      // Mostrar error inline sin bloquear las demás
      return;
    }

    if (!hasValid) {
      setMessage('Añade al menos una serie válida');
      return;
    }

    setSaving(true);
    const result = await saveWorkout(user.id);
    setSaving(false);

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setSaveSuccess(true);
      void notificationHaptic(NotificationType.Success);
      if (sound) playFeedbackSound();
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
      queryClient.invalidateQueries({ queryKey: ['recentSets'] });
      queryClient.invalidateQueries({ queryKey: ['personalRecords'] });

      let max1RM = 0;
      sets.forEach((s, i) => {
        if (!setErrors[i] && s.weight && s.reps && checkIsNewPR(s.weight, s.reps)) {
          const e1rm = Math.round(calcular1RM(Number(s.weight), Number(s.reps)));
          if (e1rm > max1RM) max1RM = e1rm;
        }
      });

      if (max1RM > 0) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFFFFF', '#fafafa', '#22c55e'],
        });
        void notificationHaptic(NotificationType.Success);

        const exerciseName = selectedExercise?.name || customExerciseName || 'Ejercicio';
        notify(t('workout.new_pr_title'), {
          body: t('workout.new_pr_body', { exercise: exerciseName, weight: max1RM }),
          icon: '/icons/icon-192x192.png',
          url: '/stats',
        });
      }

      setTimeout(() => setMessage(''), 2500);
      setTimeout(() => setSaveSuccess(false), 300);
    }
  };

  const handleAddSet = () => {
    void impact(ImpactStyle.Light);
    addSet();
  };

  const handleRemoveSet = (index: number) => {
    removeSet(index);
  };

  const handleRemoveAllSets = () => {
    if (confirm('¿Eliminar todas las series?')) {
      removeAllSets();
    }
  };

  const handleSaveNote = async () => {
    if (!user || !activeExerciseId || !noteText.trim()) return;
    try {
      await saveExerciseNote(user.id, activeExerciseId, noteText.trim());
      setNoteText('');
      refetchNotes();
    } catch (err) {
      console.error('Error saving note:', err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('¿Eliminar esta nota?')) return;
    try {
      await deleteExerciseNote(noteId);
      refetchNotes();
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const handleDeleteExercise = async (exId: string) => {
    if (!confirm('¿Eliminar este ejercicio? Se borrarán todos los registros asociados.')) return;
    try {
      await deleteExercise(exId);
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      setActiveExercise(null);
    } catch (err) {
      console.error('Error deleting exercise:', err);
    }
  };

  const handleExerciseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const isCustom = val === '__custom__';
    setCustomInput(isCustom);
    setActiveExercise(isCustom ? null : val || null);
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
      <AnimatePresence>
        {showResumeBanner && startedAt && (
          <ResumeWorkoutBanner
            onContinue={() => setShowResumeBanner(false)}
            onDiscard={() => {
              clearPersistedState();
              setShowResumeBanner(false);
            }}
          />
        )}
      </AnimatePresence>

      {activeRoutine && todayRoutine && todayRoutine.exercises.length > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
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
        initial="hidden"
        animate="show"
        className="rounded-[var(--radius-lg)] p-4 mb-3"
        style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}
      >
        <select
          value={activeExerciseId || (customInput ? '__custom__' : '')}
          onChange={handleExerciseChange}
          className="w-full rounded-lg text-sm p-2.5 outline-none appearance-none transition-all focus:scale-[1.01]"
          style={{ backgroundColor: bgCard, border: `1px solid ${border}`, color: textPrimary }}
        >
          <option value="">{t('workout.select_exercise')}</option>
          {Object.entries(groups).map(([group, exs]) => (
            <optgroup key={group} label={group}>
              {exs.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </optgroup>
          ))}
          <option value="__custom__">{t('workout.custom_exercise')}</option>
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

        {selectedExercise && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex-1 py-1.5 px-2 rounded-lg text-xs flex items-center justify-center gap-1"
              style={{
                backgroundColor: bgCard,
                border: `1px solid ${border}`,
                color: textSecondary,
              }}
            >
              <StickyNote className="w-3 h-3" />
              {t('workout.notes')} ({exerciseNotes.length})
            </button>
            {selectedExercise.user_id && (
              <button
                onClick={() => handleDeleteExercise(selectedExercise.id)}
                className="py-1.5 px-2 rounded-lg text-xs flex items-center gap-1"
                style={{
                  backgroundColor: bgCard,
                  border: `1px solid ${border}`,
                  color: 'var(--error)',
                }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {showNotes && activeExerciseId && (
          <div
            className="mt-3 p-3 rounded-lg"
            style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}
          >
            <div className="text-xs font-medium mb-2" style={{ color: textSecondary }}>
              {t('workout.no_notes')}
            </div>
            {exerciseNotes.length > 0 && (
              <div className="space-y-2 mb-3 max-h-24 overflow-y-auto">
                {exerciseNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-start justify-between p-2 rounded"
                    style={{ backgroundColor: 'var(--bg-surface-2)' }}
                  >
                    <div className="text-xs" style={{ color: textPrimary }}>
                      {note.note}
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-xs ml-2"
                      style={{ color: 'var(--error)' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t('workout.new_note')}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="flex-1 rounded-lg text-xs p-2 outline-none"
                style={{
                  backgroundColor: bgCard,
                  border: `1px solid ${border}`,
                  color: textPrimary,
                }}
              />
              <button
                onClick={handleSaveNote}
                disabled={!noteText.trim()}
                className="p-2 rounded-lg"
                style={{ backgroundColor: accent, color: 'var(--interactive-primary-fg)' }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {currentPR && (
          <div className="mt-3 text-[0.85rem]" style={{ color: accent }}>
            {t('workout.recent_pr')}: {currentPR.weight} kg × {currentPR.reps} reps
          </div>
        )}
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className={`rounded-[var(--radius-lg)] p-4 ${saveSuccess ? 'success-pulse' : ''}`}
        style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}
      >
        <div className="text-[0.9375rem] font-medium mb-2" style={{ color: textPrimary }}>
          {selectedExercise
            ? `${t('workout.sets')} — ${selectedExercise.name}`
            : customExerciseName
              ? `${t('workout.sets')} — ${customExerciseName}`
              : t('workout.sets')}
        </div>

        <div
          className="flex gap-2 mb-1.5 text-[0.65rem] font-semibold uppercase"
          style={{ color: textMuted }}
        >
          <div className="w-6"></div>
          <div className="flex-1 text-center">{t('workout.reps')}</div>
          <div className="flex-1 text-center">{t('workout.weight')}</div>
          <div className="w-6"></div>
        </div>

        {sets.length === 0 ? (
          <div className="text-center py-8" style={{ color: textMuted }}>
            {t('workout.empty_sets')}
          </div>
        ) : (
          sets.map((s, i) => {
            const isNewPR = checkIsNewPR(s.weight, s.reps);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-2"
              >
                <div className="flex gap-2 items-center">
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
                    onChange={(e) => {
                      updateSet(i, { reps: e.target.value });
                      if (setErrors[i]) {
                        setSetErrors((prev) => {
                          const n = { ...prev };
                          delete n[i];
                          return n;
                        });
                      }
                    }}
                    className={`flex-1 rounded-lg text-sm p-2 outline-none text-center ${
                      setErrors[i] ? 'border-red-500 bg-red-500/10' : ''
                    }`}
                    style={{
                      backgroundColor: setErrors[i] ? undefined : bgCard,
                      border: setErrors[i] ? undefined : `1px solid ${border}`,
                      color: textPrimary,
                    }}
                  />
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="0"
                      value={s.weight}
                      onChange={(e) => {
                        updateSet(i, { weight: e.target.value });
                        if (setErrors[i]) {
                          setSetErrors((prev) => {
                            const n = { ...prev };
                            delete n[i];
                            return n;
                          });
                        }
                      }}
                      className={`w-full rounded-lg text-sm p-2 outline-none text-center ${
                        setErrors[i] ? 'border-red-500 bg-red-500/10' : ''
                      }`}
                      style={{
                        backgroundColor: setErrors[i] ? undefined : bgCard,
                        border: setErrors[i] ? undefined : `1px solid ${border}`,
                        color: textPrimary,
                      }}
                    />
                    {isNewPR && (
                      <span className="absolute -top-1 -right-1">
                        <Trophy
                          className="w-3 h-3"
                          style={{ color: 'var(--interactive-primary)' }}
                        />
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
                </div>
                {setErrors[i] && (
                  <div className="text-[0.65rem] text-red-500 mt-1 ml-8">{setErrors[i]}</div>
                )}
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
            {t('workout.add_set')}
          </button>
          {sets.length > 1 && (
            <button
              onClick={handleRemoveAllSets}
              className="py-2 px-3 border border-dashed rounded-[var(--radius-lg)] text-sm font-medium cursor-pointer"
              style={{ borderColor: border, color: 'var(--error)' }}
              title={t('workout.remove_all')}
            >
              {t('workout.remove_all')}
            </button>
          )}
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
            {saving ? t('workout.saving') : saveSuccess ? '✓' : t('workout.save_workout')}
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
