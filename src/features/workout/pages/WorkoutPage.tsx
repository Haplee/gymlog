import { ResumeWorkoutBanner } from '@features/workout/components/ResumeWorkoutBanner';
import { WeeklyWeightPrompt } from '@features/workout/components/WeeklyWeightPrompt';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { m, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
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
  fetchBodyMeasurements,
} from '@shared/api/queries';
import { bodyWeightAtDate } from '@features/workout/utils/bodyweight';
import { isBodyweightLoad, type LoadType } from '@shared/lib/loadType';
import { ExerciseSelector } from '@shared/components/ExerciseSelector';
import { ExerciseLoadType } from '@features/workout/components/ExerciseLoadType';
import { RestTimer } from '@features/workout/components/RestTimer';
import { WorkoutSessionStats } from '@features/workout/components/WorkoutSessionStats';
import { LastSessionCard } from '@features/workout/components/LastSessionCard';
import { HealthMetricsCard } from '@features/wearables/components/HealthMetricsCard';
import { CoachSuggestionBanner } from '@features/coach/components/CoachSuggestionBanner';
import { pickDaily, pickSleepFor } from '@features/wearables/utils/pickDaily';
import {
  useWearableDaily,
  useWearableSleep,
} from '@features/wearables/hooks/useWearableConnections';
import { WorkoutSetList } from '@features/workout/components/WorkoutSetList';
import { PlatesCalculator } from '@features/workout/components/PlatesCalculator';
import {
  WorkoutSavedCard,
  type WorkoutSummary,
} from '@features/workout/components/WorkoutSavedCard';
import type { ExerciseNote, PersonalRecord } from '@shared/lib/types';
import { Trash2, Plus, StickyNote, Calculator, BookOpen, Trophy, Repeat, Star } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { impact, notificationHaptic, ImpactStyle, NotificationType } from '@shared/lib/haptics';
import { celebrate } from '@shared/lib/celebration';
import { devError } from '@shared/lib/devtools';

const containerVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const setSchema = z.object({
  reps: z.coerce.number().positive('Las repeticiones deben ser mayores a 0'),
  weight: z.coerce.number().nonnegative('El peso no puede ser negativo'),
});

export function WorkoutPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const activeExerciseId = useWorkoutStore((s) => s.activeExerciseId);
  const customExerciseName = useWorkoutStore((s) => s.customExerciseName);
  const sets = useWorkoutStore((s) => s.sets);
  const startedAt = useWorkoutStore((s) => s.startedAt);
  const sessionNotes = useWorkoutStore((s) => s.sessionNotes);
  const sessionRating = useWorkoutStore((s) => s.sessionRating);
  const {
    setActiveExercise,
    addSet,
    setSets,
    updateSet,
    removeSet,
    removeAllSets,
    saveWorkout,
    repeatWorkout,
    clearPersistedState,
    setSessionNotes,
    setSessionRating,
    setBodyweightContext,
  } = useWorkoutStore(
    useShallow((s) => ({
      setActiveExercise: s.setActiveExercise,
      addSet: s.addSet,
      setSets: s.setSets,
      updateSet: s.updateSet,
      removeSet: s.removeSet,
      removeAllSets: s.removeAllSets,
      saveWorkout: s.saveWorkout,
      repeatWorkout: s.repeatWorkout,
      clearPersistedState: s.clearPersistedState,
      setSessionNotes: s.setSessionNotes,
      setSessionRating: s.setSessionRating,
      setBodyweightContext: s.setBodyweightContext,
    })),
  );

  // Selectores finos: suscribirse al store entero re-renderizaba la página en
  // cada cambio de cualquier ajuste, rutina o tick del temporizador.
  const {
    sound,
    showWarmupSets,
    restAutoStart,
    restDuration: defaultRest,
    restByExercise,
  } = useSettingsStore(
    useShallow((s) => ({
      sound: s.sound,
      showWarmupSets: s.showWarmupSets,
      restAutoStart: s.restAutoStart,
      restDuration: s.restDuration,
      restByExercise: s.restByExercise,
    })),
  );
  const { getActiveRoutine, getTodayRoutine, checkAndBackup } = useRoutineStore(
    useShallow((s) => ({
      getActiveRoutine: s.getActiveRoutine,
      getTodayRoutine: s.getTodayRoutine,
      checkAndBackup: s.checkAndBackup,
    })),
  );
  // Los getters leen el estado con get(): hay que suscribirse a lo que los hace
  // cambiar para que la tarjeta de "rutina de hoy" no se quede obsoleta.
  const routines = useRoutineStore((s) => s.routines);
  const activeRoutineId = useRoutineStore((s) => s.activeRoutineId);
  const { unit: weightUnit, convert, convertFromDisplay: convertToKg } = useWeight();
  const startRestTimer = useRestTimerStore((s) => s.start);
  const restTimerRunning = useRestTimerStore((s) => s.isRunning);

  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [setErrors, setSetErrors] = useState<Record<number, string>>({});
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [showPlates, setShowPlates] = useState(false);
  const [completed, setCompleted] = useState<WorkoutSummary | null>(null);
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

  // Resumen de salud (wearable) para la tarjeta glanceable del inicio.
  // Varios días, no uno: de madrugada el día en curso no tiene pulsaciones y
  // hay que caer al último con datos reales (ver pickDaily).
  const { data: wearableDaily } = useWearableDaily(7);
  const { data: wearableSleep } = useWearableSleep(7);
  const hasWearableData = Boolean(wearableDaily?.length || wearableSleep?.length);
  const wearableDay = pickDaily(wearableDaily);

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

  // Peso corporal vigente (hoy) para ejercicios de peso corporal.
  const { data: bodyMeasurements = [] } = useQuery({
    queryKey: ['bodyMeasurements', user?.id],
    queryFn: () => fetchBodyMeasurements(user?.id ?? ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 30,
  });
  const currentBodyWeight = useMemo(
    () => bodyWeightAtDate(bodyMeasurements, new Date().toISOString().split('T')[0]),
    [bodyMeasurements],
  );
  const isBodyweightExercise = isBodyweightLoad(selectedExercise?.load_type);

  // Mantener el store al día con el contexto de peso corporal del ejercicio activo.
  useEffect(() => {
    setBodyweightContext(isBodyweightExercise, currentBodyWeight);
  }, [isBodyweightExercise, currentBodyWeight, setBodyweightContext]);
  const currentPRs = useMemo(
    () => (activeExerciseId ? (prsByExercise[activeExerciseId] ?? []) : []),
    [activeExerciseId, prsByExercise],
  );
  const currentPR = useMemo(() => {
    if (!currentPRs.length) return null;
    return currentPRs.reduce((best, pr) => ((pr.one_rm ?? 0) > (best.one_rm ?? 0) ? pr : best));
  }, [currentPRs]);

  const activeRoutine = useMemo(
    () => getActiveRoutine(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getActiveRoutine, routines, activeRoutineId],
  );
  const todayRoutine = useMemo(
    () => getTodayRoutine(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getTodayRoutine, routines, activeRoutineId],
  );

  // En modo peso corporal el kg introducido es lastre; el peso efectivo por rep
  // es (peso corporal vigente + lastre), igual que lo que se guarda en saveWorkout.
  const sessionVolume = useMemo(
    () =>
      sets.reduce((sum, s) => {
        const r = Number(s.reps) || 0;
        const entered = Number(s.weight) || 0;
        const w = isBodyweightExercise ? (currentBodyWeight ?? 0) + entered : entered;
        return sum + r * w;
      }, 0),
    [sets, isBodyweightExercise, currentBodyWeight],
  );

  // En modo peso corporal una serie es válida solo con reps (el lastre es opcional).
  const validSetCount = useMemo(
    () => sets.filter((s) => s.reps && (isBodyweightExercise || s.weight)).length,
    [sets, isBodyweightExercise],
  );

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

    // saveWorkout limpia la sesión: hay que quedarse con el resumen antes.
    const summaryMinutes = startedAt
      ? Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000))
      : 0;
    const summarySets = validSetCount;
    const summaryVolume = `${convert(sessionVolume).toFixed(0)} ${weightUnit}`;

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

      let prLabel: string | undefined;
      if (max1RM > 0) {
        celebrate();
        void notificationHaptic(NotificationType.Success);
        const exerciseName = selectedExercise?.name || customExerciseName || 'Ejercicio';
        prLabel = `Nuevo PR: ${exerciseName} - ${convert(max1RM).toFixed(1)} ${weightUnit}`;
        setMessage(prLabel);
      }

      setCompleted({
        minutes: summaryMinutes,
        volume: summaryVolume,
        sets: summarySets,
        prLabel,
      });

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
        {completed && <WorkoutSavedCard summary={completed} onDismiss={() => setCompleted(null)} />}
      </AnimatePresence>

      {/* Solo aparece si se ha llegado aquí desde «Aplicar» en el entrenador. */}
      <CoachSuggestionBanner />

      <WeeklyWeightPrompt />
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
          className="mb-3 rounded-card bg-accent p-4 shadow-fab"
        >
          {/* Tarjeta destacada del kit ("Training Of The Day"): bloque relleno
              del acento con etiqueta, título y los ejercicios como chips. */}
          <span className="label-caps inline-block rounded-pill bg-accent-fg/15 px-2.5 py-1 text-accent-fg">
            {t('routine.today')}
          </span>
          <div className="mt-2 font-display text-lg font-bold text-accent-fg">
            {todayRoutine.name}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {todayRoutine.exercises.slice(0, 4).map((ex) => (
              <span
                key={ex.name}
                className="rounded-pill bg-accent-fg/10 px-2.5 py-1 text-xs font-medium text-accent-fg"
              >
                {ex.name}
              </span>
            ))}
            {todayRoutine.exercises.length > 4 && (
              <span className="px-1 py-1 text-xs text-accent-fg/85">
                +{todayRoutine.exercises.length - 4}
              </span>
            )}
          </div>
        </m.div>
      )}

      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.25, ease: 'easeOut', delay: 0.05 }}
        className="rounded-card p-4 mb-3 bg-surface border border-line-strong shadow-card"
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
          type="button"
          onClick={() => navigate('/exercises')}
          className="mt-2 w-full py-2 px-2 rounded-card text-xs flex items-center justify-center gap-1.5 bg-surface-2 border border-line text-fg-muted transition-colors active:bg-hover"
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
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="flex-1 py-2 px-2 rounded-card text-xs flex items-center justify-center gap-1 bg-surface-2 border border-line text-fg-muted transition-colors active:bg-hover"
            >
              <StickyNote className="w-3 h-3" />
              {t('workout.notes')} ({exerciseNotes.length})
            </button>
            {selectedExercise.user_id && (
              <button
                type="button"
                onClick={() => handleDeleteExercise(selectedExercise.id)}
                className="py-2 px-2 rounded-card text-xs flex items-center gap-1 bg-surface-2 border border-line text-error transition-colors active:bg-hover"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {showNotes && activeExerciseId && (
          <div className="mt-3 p-3 rounded-card bg-surface border border-line-strong">
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
                      type="button"
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
                className="flex-1 rounded-card text-xs p-2 outline-none bg-surface-2 border border-line text-fg"
              />
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={!noteText.trim()}
                className="p-2 rounded-card bg-accent text-accent-fg"
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
        className={`rounded-card p-4 bg-surface border border-line-strong shadow-card ${saveSuccess ? 'success-pulse' : ''}`}
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
                    className="text-2xs font-mono tabular-nums px-1.5 py-0.5 rounded-sm bg-surface-2 border border-line text-fg-muted"
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
            type="button"
            onClick={() => setShowPlates(true)}
            aria-label={t('workout.plates_calc')}
            className="flex-shrink-0 min-h-11 px-2.5 flex items-center gap-1.5 rounded-card text-xs bg-surface-2 border border-line text-fg-muted"
          >
            <Calculator className="w-4 h-4" />
          </button>
        </div>

        {selectedExercise && (
          <ExerciseLoadType
            exerciseId={selectedExercise.id}
            exerciseName={selectedExercise.name}
            loadType={(selectedExercise.load_type as LoadType | undefined) ?? 'external'}
            equipment={selectedExercise.equipment}
          />
        )}

        {sets.length > 0 && (
          <div className="flex gap-1.5 mb-1.5 text-2xs font-semibold uppercase text-fg-subtle">
            {showWarmupSets && <div className="w-9 flex-shrink-0" />}
            <div className="w-7 flex-shrink-0" />
            <div className="flex-1 text-center">{t('workout.reps')}</div>
            <div className="flex-1 text-center">
              {isBodyweightExercise ? `${t('workout.load_label')} (${weightUnit})` : weightUnit}
            </div>
            <div className="w-9 flex-shrink-0" />
            <div className="w-9 flex-shrink-0" />
          </div>
        )}

        {sets.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-2 gap-4">
            <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center">
              <Plus className="w-7 h-7 text-accent" aria-hidden="true" />
            </div>
            <div>
              <div className="text-base font-semibold text-fg">{t('workout.empty_sets')}</div>
              <div className="text-sm text-fg-subtle mt-1">{t('workout.empty_hint')}</div>
            </div>
            <div className="flex flex-col items-stretch gap-2 w-full max-w-[16rem]">
              <button
                type="button"
                onClick={addSet}
                className="w-full py-3 rounded-pill bg-accent text-accent-fg font-semibold shadow-btn-accent active:scale-[0.98]"
              >
                {t('workout.add_set')}
              </button>
              {lastWorkout && lastWorkout.sets.length > 0 && (
                <button
                  type="button"
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
          <>
            {isBodyweightExercise && (
              <div className="mb-2 px-3 py-2 rounded-md bg-surface-2 text-xs text-fg-muted">
                {currentBodyWeight != null
                  ? t('workout.bodyweight_hint', {
                      weight: `${convert(currentBodyWeight).toFixed(1)} ${weightUnit}`,
                    })
                  : t('workout.bodyweight_no_weight')}
              </div>
            )}
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
          </>
        )}
      </m.div>

      {/* Barra de acción fija sobre la navegación inferior (solo con series) */}
      {sets.length > 0 && (
        <div className="-mx-4 mt-3 px-4 pt-3 pb-3 bg-canvas border-t border-line">
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
              className="w-full resize-none rounded-card text-sm p-2 outline-none bg-surface-2 border border-line text-fg placeholder:text-fg-subtle"
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
              type="button"
              onClick={handleAddSet}
              className="flex-1 py-2 px-3 border border-dashed rounded-card text-sm font-medium cursor-pointer border-line-strong text-fg-muted"
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
                      type="button"
                      onClick={() => {
                        removeAllSets();
                        setConfirmDeleteAll(false);
                      }}
                      className="py-2 px-3 rounded-card text-sm font-medium bg-error text-white"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAll(false)}
                      className="py-2 px-3 rounded-card text-sm border border-line-strong text-fg-subtle"
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
                    className="py-2 px-3 border border-dashed rounded-card text-sm font-medium cursor-pointer border-line-strong text-error"
                    title={t('workout.remove_all')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </m.button>
                )}
              </AnimatePresence>
            )}

            <button
              type="button"
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

      {/* Resumen de salud del wearable (glanceable), debajo del temporizador de
          descanso. Solo en reposo y si hay datos. Pulsable -> detalle en /wearables. */}
      {isIdle && hasWearableData && (
        <div className="mt-3">
          <HealthMetricsCard
            daily={wearableDay}
            sleep={pickSleepFor(wearableDay, wearableSleep)}
            onOpen={() => navigate('/wearables')}
          />
        </div>
      )}

      <PlatesCalculator
        key={showPlates ? `plates-${Math.round(bestEstimate?.weightKg ?? 0)}` : 'plates-closed'}
        open={showPlates}
        initialTargetKg={bestEstimate?.weightKg}
        onClose={() => setShowPlates(false)}
      />
    </Layout>
  );
}
