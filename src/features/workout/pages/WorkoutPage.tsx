import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { m, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { useWeight } from '@shared/hooks/useWeight';
import { calcular1RM } from '@shared/lib/brzycki';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { useRestTimerStore } from '@features/workout/stores/restTimerStore';
import { Layout } from '@app/components/Layout';
import {
  fetchExercises,
  fetchPersonalRecords,
  fetchExerciseNotes,
  saveExerciseNote,
  deleteExerciseNote,
  deleteExercise,
  fetchWorkoutsPaginated,
} from '@shared/api/queries';
import { ExerciseSelector } from '@features/workout/components/ExerciseSelector';
import { RestTimer } from '@features/workout/components/RestTimer';
import { WorkoutSessionStats } from '@features/workout/components/WorkoutSessionStats';
import { LastSessionCard } from '@features/workout/components/LastSessionCard';
import { WorkoutSetList } from '@features/workout/components/WorkoutSetList';
import { PlatesCalculator } from '@features/workout/components/PlatesCalculator';
import type { ExerciseNote, PersonalRecord } from '@shared/lib/types';
import {
  Trash2,
  Plus,
  StickyNote,
  AlertCircle,
  Calculator,
  BookOpen,
  Trophy,
  Repeat,
  Star,
} from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { impact, notificationHaptic, ImpactStyle, NotificationType } from '@shared/lib/haptics';
import { devError } from '@shared/lib/devtools';

const containerVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const setSchema = z.object({
  reps: z.coerce.number().positive('Las repeticiones deben ser mayores a 0'),
  weight: z.coerce.number().nonnegative('El peso no puede ser negativo'),
});

function ResumeWorkoutBanner({
  onContinue,
  onDiscard,
}: {
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mb-4 p-4 rounded-xl border-2 border-accent bg-accent/5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2 text-accent">
        <AlertCircle className="w-5 h-5" />
        <span className="font-semibold text-sm">{t('workout.resume_banner')}</span>
      </div>
      <p className="text-xs text-fg-muted">{t('workout.resume_desc')}</p>
      <div className="flex gap-2">
        <button
          onClick={onContinue}
          className="flex-1 py-2 rounded-lg bg-accent text-accent-fg text-xs font-bold"
        >
          {t('workout.continue')}
        </button>
        <button
          onClick={onDiscard}
          className="flex-1 py-2 rounded-lg border border-line-strong text-fg-muted text-xs font-medium"
        >
          {t('workout.discard')}
        </button>
      </div>
    </m.div>
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
    addSet,
    setSets,
    updateSet,
    removeSet,
    removeAllSets,
    saveWorkout,
    repeatWorkout,
    clearPersistedState,
    sessionNotes,
    sessionRating,
    setSessionNotes,
    setSessionRating,
  } = useWorkoutStore();

  const {
    sound,
    showWarmupSets,
    restAutoStart,
    restDuration: defaultRest,
    restByExercise,
  } = useSettingsStore();
  const { getActiveRoutine, getTodayRoutine, checkAndBackup } = useRoutineStore();
  const { unit: weightUnit, convert, convertFromDisplay: convertToKg } = useWeight();
  const { start: startRestTimer, isRunning: restTimerRunning } = useRestTimerStore();

  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [setErrors, setSetErrors] = useState<Record<number, string>>({});
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [showPlates, setShowPlates] = useState(false);
  const [showResumeBanner, setShowResumeBanner] = useState(() => {
    if (startedAt && sets.length > 0) {
      return Date.now() - new Date(startedAt).getTime() < 12 * 60 * 60 * 1000;
    }
    return false;
  });

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', user?.id],
    queryFn: () => fetchExercises(user?.id ?? ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: personalRecordsList = [] } = useQuery({
    queryKey: ['personalRecords', user?.id],
    queryFn: () => fetchPersonalRecords(user?.id ?? ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: exerciseNotes = [] } = useQuery({
    queryKey: ['exerciseNotes', user?.id, activeExerciseId],
    queryFn: () => fetchExerciseNotes(user?.id ?? '', activeExerciseId ?? ''),
    enabled: !!user?.id && !!activeExerciseId,
  });

  // Último entreno completo: solo cuando no hay sesión en curso, para ofrecer
  // "Repetir último entreno" como acción rápida.
  const isIdle = sets.length === 0 && !startedAt;
  const { data: lastWorkoutPage } = useQuery({
    queryKey: ['lastWorkoutFull', user?.id],
    queryFn: () => fetchWorkoutsPaginated(user?.id ?? '', null, 1),
    enabled: !!user?.id && isIdle,
    staleTime: 1000 * 60 * 5,
  });
  const lastWorkout = lastWorkoutPage?.workouts[0];

  // Ahora hay varios PR por ejercicio (uno por banda de reps). Agrupamos por
  // ejercicio y, para el indicador principal, tomamos el de mayor 1RM estimado.
  const prsByExercise = useMemo(() => {
    const map: Record<string, PersonalRecord[]> = {};
    for (const pr of personalRecordsList) {
      (map[pr.exercise_id] ??= []).push(pr);
    }
    for (const k in map) map[k].sort((a, b) => a.rep_band - b.rep_band);
    return map;
  }, [personalRecordsList]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    checkAndBackup(user.id);
    if (startedAt && sets.length > 0) {
      if (Date.now() - new Date(startedAt).getTime() >= 12 * 60 * 60 * 1000) {
        clearPersistedState();
      }
    }
  }, [user, navigate, checkAndBackup, startedAt, sets.length, clearPersistedState]);

  const selectedExercise = useMemo(
    () => exercises.find((e) => e.id === activeExerciseId),
    [exercises, activeExerciseId],
  );
  const currentPRs = useMemo(
    () => (activeExerciseId ? (prsByExercise[activeExerciseId] ?? []) : []),
    [activeExerciseId, prsByExercise],
  );
  const currentPR = useMemo(() => {
    if (!currentPRs.length) return null;
    return currentPRs.reduce((best, pr) => ((pr.one_rm ?? 0) > (best.one_rm ?? 0) ? pr : best));
  }, [currentPRs]);

  const activeRoutine = getActiveRoutine();
  const todayRoutine = getTodayRoutine();

  const sessionVolume = useMemo(
    () =>
      sets.reduce((sum, s) => {
        const r = Number(s.reps) || 0;
        const w = Number(s.weight) || 0;
        return sum + r * w;
      }, 0),
    [sets],
  );

  const validSetCount = useMemo(() => sets.filter((s) => s.reps && s.weight).length, [sets]);

  // Mejor 1RM estimado de la sesión (excluye calentamientos). Pesos en kg.
  const bestEstimate = useMemo(() => {
    let best: { weightKg: number; e1rm: number } | null = null;
    for (const s of sets) {
      if (s.isWarmup) continue;
      const w = Number(s.weight);
      const r = Number(s.reps);
      if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) continue;
      const e1rm = calcular1RM(w, r);
      if (!best || e1rm > best.e1rm) best = { weightKg: w, e1rm };
    }
    return best;
  }, [sets]);

  const playFeedbackSound = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
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

  const triggerConfetti = useCallback(async () => {
    const confettiModule = await import('canvas-confetti');
    confettiModule.default({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#c8ff00', '#ffffff', '#22c55e'],
    });
  }, []);

  const checkIsNewPR = useCallback(
    (weight: string, reps: string): boolean => {
      if (!currentPR) return false;
      const current1RM =
        currentPR.one_rm || calcular1RM(Number(currentPR.weight) || 0, Number(currentPR.reps) || 0);
      return calcular1RM(Number(weight) || 0, Number(reps) || 0) > current1RM;
    },
    [currentPR],
  );

  const handleSave = async () => {
    if (!user || saving) return;
    setMessage('');
    setSetErrors({});

    const newErrors: Record<number, string> = {};
    let hasValid = false;

    sets.forEach((s, i) => {
      if ((s.reps === '' || s.reps === '0') && (s.weight === '' || s.weight === '0')) return;
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
      return;
    }
    if (!hasValid) {
      setMessage(t('workout.add_valid_set'));
      return;
    }

    setSaving(true);
    const result = await saveWorkout(user.id);
    setSaving(false);

    if (result.error) {
      setMessage(result.error.message);
      toast.error(result.error.message);
    } else if (result.queued) {
      // Guardado offline: se sincronizará al volver la conexión.
      setSaveSuccess(true);
      setMessage(t('workout.saved_offline'));
      toast.success(t('workout.saved_offline'));
      void notificationHaptic(NotificationType.Success);
      setTimeout(() => setMessage(''), 2500);
      setTimeout(() => setSaveSuccess(false), 300);
    } else {
      setSaveSuccess(true);
      setMessage(t('workout.saved'));
      toast.success(t('workout.saved'));
      void notificationHaptic(NotificationType.Success);
      if (sound) playFeedbackSound();
      // refetchType: 'all' refresca también queries inactivas (p.ej. HistoryPage
      // o StatsPage sin montar). Con refetchOnMount:false global, sin esto los
      // datos guardados no aparecerían hasta un refetch manual.
      queryClient.invalidateQueries({ queryKey: ['workouts'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['recentSets'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['workoutsAndSets'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['personalRecords'], refetchType: 'all' });
      if (activeExerciseId) {
        queryClient.invalidateQueries({
          queryKey: ['lastExerciseSets', user.id, activeExerciseId],
          refetchType: 'all',
        });
      }

      let max1RM = 0;
      sets.forEach((s, i) => {
        if (!newErrors[i] && s.weight && s.reps && checkIsNewPR(s.weight, s.reps)) {
          const e1rm = Math.round(calcular1RM(Number(s.weight), Number(s.reps)));
          if (e1rm > max1RM) max1RM = e1rm;
        }
      });

      if (max1RM > 0) {
        triggerConfetti();
        void notificationHaptic(NotificationType.Success);
        const exerciseName = selectedExercise?.name || customExerciseName || 'Ejercicio';
        setMessage(`Nuevo PR: ${exerciseName} - ${convert(max1RM).toFixed(1)} ${weightUnit}`);
      }

      setTimeout(() => setMessage(''), 2500);
      setTimeout(() => setSaveSuccess(false), 300);
    }
  };

  const handleAddSet = () => {
    void impact(ImpactStyle.Light);
    const lastSet = sets.at(-1);
    const lastHasData = lastSet && lastSet.reps && lastSet.weight;
    addSet();
    if (restAutoStart && lastHasData && !restTimerRunning && defaultRest > 0) {
      // Ejercicios compuestos descansan más (≈2×), capado a 10 min.
      const rest =
        restByExercise && selectedExercise?.is_compound
          ? Math.min(defaultRest * 2, 600)
          : defaultRest;
      startRestTimer(rest);
    }
  };

  const handleRemoveSet = (index: number) => removeSet(index);

  const handleCopySets = useCallback(
    (copied: { reps: number; weight: number }[]) => {
      if (!copied.length) return;
      setSets(
        copied.map((s) => ({
          id: crypto.randomUUID(),
          reps: String(s.reps),
          weight: String(s.weight),
          notes: '',
          isWarmup: false,
          rpe: '',
          setType: 'normal' as const,
        })),
      );
      void impact(ImpactStyle.Light);
    },
    [setSets],
  );

  const handleSaveNote = useCallback(async () => {
    if (!user || !activeExerciseId || !noteText.trim()) return;
    const text = noteText.trim();
    setNoteText('');
    const tempId = `temp-${Date.now()}`;
    queryClient.setQueryData(
      ['exerciseNotes', user.id, activeExerciseId],
      (old: ExerciseNote[] = []) => [
        {
          id: tempId,
          note: text,
          exercise_id: activeExerciseId,
          user_id: user.id,
          created_at: new Date().toISOString(),
        } as ExerciseNote,
        ...old,
      ],
    );
    try {
      const saved = await saveExerciseNote(user.id, activeExerciseId, text);
      queryClient.setQueryData(
        ['exerciseNotes', user.id, activeExerciseId],
        (old: ExerciseNote[] = []) => [saved, ...old.filter((n) => n.id !== tempId)],
      );
    } catch {
      queryClient.setQueryData(
        ['exerciseNotes', user.id, activeExerciseId],
        (old: ExerciseNote[] = []) => old.filter((n) => n.id !== tempId),
      );
      toast.error(t('workout.note_save_error'));
    }
  }, [user, activeExerciseId, noteText, queryClient, t]);

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      if (!user || !activeExerciseId) return;
      queryClient.setQueryData(
        ['exerciseNotes', user.id, activeExerciseId],
        (old: ExerciseNote[] = []) => old.filter((n) => n.id !== noteId),
      );
      await deleteExerciseNote(noteId).catch(() => {
        queryClient.invalidateQueries({ queryKey: ['exerciseNotes', user.id, activeExerciseId] });
      });
    },
    [user, activeExerciseId, queryClient],
  );

  const handleDeleteExercise = useCallback(
    async (exId: string) => {
      try {
        await deleteExercise(exId);
        queryClient.invalidateQueries({ queryKey: ['exercises'] });
        setActiveExercise(null);
      } catch (err) {
        devError('Error deleting exercise:', err);
      }
    },
    [queryClient, setActiveExercise],
  );

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

      {/* Session Stats */}
      <WorkoutSessionStats
        startedAt={startedAt}
        totalVolume={sessionVolume}
        totalSets={validSetCount}
        onCancel={() => clearPersistedState()}
      />

      {activeRoutine && todayRoutine && todayRoutine.exercises.length > 0 && (
        <m.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="mb-3 p-3 rounded-2xl bg-surface border border-line shadow-card"
        >
          <div className="text-sm font-medium mb-1 text-accent">{todayRoutine.name}</div>
          <div className="flex flex-wrap gap-1.5">
            {todayRoutine.exercises.slice(0, 4).map((ex, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-pill bg-surface-2 text-fg-muted">
                {ex.name}
              </span>
            ))}
            {todayRoutine.exercises.length > 4 && (
              <span className="text-xs text-fg-subtle">+{todayRoutine.exercises.length - 4}</span>
            )}
          </div>
        </m.div>
      )}

      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.25, ease: 'easeOut', delay: 0.05 }}
        className="rounded-2xl p-4 mb-3 bg-surface border border-line-strong shadow-card"
      >
        {user && (
          <ExerciseSelector
            userId={user.id}
            onSelect={(id) => {
              setActiveExercise(id);
              if (!sets.length) addSet();
            }}
            activeExerciseId={activeExerciseId}
          />
        )}

        <button
          onClick={() => navigate('/exercises')}
          className="mt-2 w-full py-2 px-2 rounded-lg text-xs flex items-center justify-center gap-1.5 bg-surface-2 border border-line text-fg-muted transition-colors active:bg-hover"
        >
          <BookOpen className="w-3.5 h-3.5" />
          {t('library.open')}
        </button>

        {/* Last Session Reference */}
        {user && activeExerciseId && (
          <LastSessionCard
            userId={user.id}
            exerciseId={activeExerciseId}
            onCopySets={handleCopySets}
          />
        )}

        {selectedExercise && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex-1 py-2 px-2 rounded-lg text-xs flex items-center justify-center gap-1 bg-surface-2 border border-line text-fg-muted transition-colors active:bg-hover"
            >
              <StickyNote className="w-3 h-3" />
              {t('workout.notes')} ({exerciseNotes.length})
            </button>
            {selectedExercise.user_id && (
              <button
                onClick={() => handleDeleteExercise(selectedExercise.id)}
                className="py-2 px-2 rounded-lg text-xs flex items-center gap-1 bg-surface-2 border border-line text-error transition-colors active:bg-hover"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {showNotes && activeExerciseId && (
          <div className="mt-3 p-3 rounded-lg bg-surface border border-line-strong">
            <div className="text-xs font-medium mb-2 text-fg-muted">{t('workout.no_notes')}</div>
            {exerciseNotes.length > 0 && (
              <div className="space-y-2 mb-3 max-h-24 overflow-y-auto">
                {exerciseNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-start justify-between p-2 rounded bg-surface-2"
                  >
                    <div className="text-xs text-fg">{note.note}</div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-xs ml-2 text-error"
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
                className="flex-1 rounded-lg text-xs p-2 outline-none bg-surface-2 border border-line text-fg"
              />
              <button
                onClick={handleSaveNote}
                disabled={!noteText.trim()}
                className="p-2 rounded-lg bg-accent text-accent-fg"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </m.div>

      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.25, ease: 'easeOut', delay: 0.1 }}
        className={`rounded-2xl p-4 bg-surface border border-line-strong shadow-card ${saveSuccess ? 'success-pulse' : ''}`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="text-lg font-semibold leading-tight text-fg truncate">
              {selectedExercise?.name ?? customExerciseName ?? t('workout.sets')}
            </div>
            {(currentPR || bestEstimate) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {currentPR && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                    <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('workout.recent_pr')} {convert(Number(currentPR.weight)).toFixed(1)}{' '}
                    {weightUnit} × {currentPR.reps}
                  </span>
                )}
                {bestEstimate && (
                  <span className="font-mono tabular-nums text-xs text-fg-muted">
                    {t('workout.e1rm')} {convert(bestEstimate.e1rm).toFixed(1)} {weightUnit}
                  </span>
                )}
              </div>
            )}
            {currentPRs.length > 1 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {currentPRs.map((pr) => (
                  <span
                    key={pr.rep_band}
                    className="text-2xs font-mono tabular-nums px-1.5 py-0.5 rounded-pill bg-surface-2 border border-line text-fg-muted"
                    title={t('workout.pr_by_band')}
                  >
                    {pr.rep_band === 15 ? '15+' : pr.rep_band}r ·{' '}
                    {convert(Number(pr.weight)).toFixed(0)}
                    {weightUnit}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowPlates(true)}
            aria-label={t('workout.plates_calc')}
            className="flex-shrink-0 min-h-11 px-2.5 flex items-center gap-1.5 rounded-lg text-xs bg-surface-2 border border-line text-fg-muted"
          >
            <Calculator className="w-4 h-4" />
          </button>
        </div>

        {sets.length > 0 && (
          <div className="flex gap-1.5 mb-1.5 text-2xs font-semibold uppercase text-fg-subtle">
            {showWarmupSets && <div className="w-9 flex-shrink-0" />}
            <div className="w-7 flex-shrink-0" />
            <div className="flex-1 text-center">{t('workout.reps')}</div>
            <div className="flex-1 text-center">{weightUnit}</div>
            <div className="w-9 flex-shrink-0" />
            <div className="w-9 flex-shrink-0" />
          </div>
        )}

        {sets.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-2 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-line flex items-center justify-center">
              <Plus className="w-7 h-7 text-accent" aria-hidden="true" />
            </div>
            <div>
              <div className="text-base font-semibold text-fg">{t('workout.empty_sets')}</div>
              <div className="text-sm text-fg-subtle mt-1">{t('workout.empty_hint')}</div>
            </div>
            <div className="flex flex-col items-stretch gap-2 w-full max-w-[16rem]">
              <button
                onClick={addSet}
                className="w-full py-3 rounded-pill bg-accent text-accent-fg font-semibold shadow-btn-accent active:scale-[0.98]"
              >
                {t('workout.add_set')}
              </button>
              {lastWorkout && lastWorkout.sets.length > 0 && (
                <button
                  onClick={() => repeatWorkout(lastWorkout)}
                  className="w-full py-3 rounded-pill bg-surface-2 border border-line text-fg-muted flex items-center justify-center gap-1.5 transition-colors active:bg-hover"
                >
                  <Repeat className="w-4 h-4" />
                  {t('workout.repeat_last')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <WorkoutSetList
            sets={sets}
            showWarmupSets={showWarmupSets}
            setErrors={setErrors}
            setSetErrors={setSetErrors}
            updateSet={updateSet}
            removeSet={handleRemoveSet}
            checkIsNewPR={checkIsNewPR}
            weightUnit={weightUnit}
            convert={convert}
            convertToKg={convertToKg}
            t={t}
          />
        )}
      </m.div>

      {/* Barra de acción fija sobre la navegación inferior (solo con series) */}
      {sets.length > 0 && (
        <div className="-mx-4 mt-3 px-4 pt-3 pb-3 bg-base border-t border-line">
          <div className="mb-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-fg-muted">
                {t('workout.session_rating')}
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${t('workout.session_rating')} ${n}`}
                    aria-pressed={sessionRating === n}
                    onClick={() => {
                      void impact(ImpactStyle.Light);
                      setSessionRating(sessionRating === n ? null : n);
                    }}
                    className="min-h-11 min-w-9 flex items-center justify-center"
                  >
                    <Star
                      className={`w-5 h-5 transition-colors ${
                        sessionRating && n <= sessionRating
                          ? 'fill-accent text-accent'
                          : 'text-fg-subtle'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder={t('workout.session_notes_placeholder')}
              rows={2}
              aria-label={t('workout.session_notes')}
              className="w-full resize-none rounded-lg text-sm p-2 outline-none bg-surface-2 border border-line text-fg placeholder:text-fg-subtle"
            />
          </div>
          {message && (
            <div
              className="mb-2 text-center text-sm"
              style={{ color: message.startsWith('✓') ? 'var(--success)' : 'var(--error)' }}
            >
              {message}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAddSet}
              className="flex-1 py-2 px-3 border border-dashed rounded-2xl text-sm font-medium cursor-pointer border-line-strong text-fg-muted"
            >
              {t('workout.add_set')}
            </button>

            {sets.length > 1 && (
              <AnimatePresence mode="wait">
                {confirmDeleteAll ? (
                  <m.div
                    key="confirm"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex gap-1"
                  >
                    <button
                      onClick={() => {
                        removeAllSets();
                        setConfirmDeleteAll(false);
                      }}
                      className="py-2 px-3 rounded-2xl text-sm font-medium bg-error text-white"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setConfirmDeleteAll(false)}
                      className="py-2 px-3 rounded-2xl text-sm border border-line-strong text-fg-subtle"
                    >
                      ✕
                    </button>
                  </m.div>
                ) : (
                  <m.button
                    key="delete-all"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setConfirmDeleteAll(true)}
                    className="py-2 px-3 border border-dashed rounded-2xl text-sm font-medium cursor-pointer border-line-strong text-error"
                    title={t('workout.remove_all')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </m.button>
                )}
              </AnimatePresence>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex-1 py-3 px-4 rounded-pill text-base font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none text-accent-fg ${
                saveSuccess ? 'bg-success' : 'bg-accent'
              }`}
            >
              {saving ? t('workout.saving') : saveSuccess ? '✓' : t('workout.save_workout')}
            </button>
          </div>
        </div>
      )}

      <RestTimer />

      <PlatesCalculator
        key={showPlates ? `plates-${Math.round(bestEstimate?.weightKg ?? 0)}` : 'plates-closed'}
        open={showPlates}
        initialTargetKg={bestEstimate?.weightKg}
        onClose={() => setShowPlates(false)}
      />
    </Layout>
  );
}
