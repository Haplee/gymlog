import { ResumeWorkoutBanner } from '@features/workout/components/ResumeWorkoutBanner';
import { WeeklyWeightPrompt } from '@features/workout/components/WeeklyWeightPrompt';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { m, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { useWeight } from '@shared/hooks/useWeight';
import { formatWeightInput } from '@shared/lib/weight';
import { toLocalDateKey } from '@shared/lib/dateKeys';
import { calcular1RM } from '@shared/lib/brzycki';
import { loadStepFromSettings } from '@shared/hooks/useLoadStep';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { useRestTimerStore } from '@features/workout/stores/restTimerStore';
import { Layout } from '@app/components/Layout';
import { ConfirmDialog } from '@shared/components/ui/ConfirmDialog';
import { registerBackAction } from '@shared/lib/backHandler';
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
import { ExercisePicker } from '@features/workout/components/ExercisePicker';
import { ExerciseLoadType } from '@features/workout/components/ExerciseLoadType';
import { RestTimer } from '@features/workout/components/RestTimer';
import { WorkoutSessionStats } from '@features/workout/components/WorkoutSessionStats';
import { SessionRatingSheet } from '@features/workout/components/SessionRatingSheet';
import { WorkoutActionBar } from '@features/workout/components/WorkoutActionBar';
import { LastSessionCard } from '@features/workout/components/LastSessionCard';
import { HealthMetricsCard } from '@features/wearables/components/HealthMetricsCard';
import { CoachSuggestionBanner } from '@features/coach/components/CoachSuggestionBanner';
import { CoachHomeCard } from '@features/coach/components/CoachHomeCard';
import { NextSessionCard } from '@features/stats/components/NextSessionCard';
import { useExerciseAdvice } from '@features/stats/hooks/useExerciseAdvice';
import { useExerciseRepRange } from '@shared/hooks/useExerciseRepRange';
import {
  readSaveScope,
  writeSaveScope,
  resolveSaveScope,
  type SaveScope,
} from '@features/workout/lib/saveScopePreference';
import { useProgressionStore } from '@features/routine/stores/progressionStore';
import type { LoadSuggestion } from '@features/stats/utils/autoregulation';
import { pickDaily, pickSleepFor } from '@features/wearables/utils/pickDaily';
import {
  useWearableDaily,
  useWearableSleep,
} from '@features/wearables/hooks/useWearableConnections';
import { WorkoutSetList } from '@features/workout/components/WorkoutSetList';
import { RoutineDayHeader } from '@features/workout/components/RoutineDayHeader';
import { EmptyWorkoutState } from '@features/workout/components/EmptyWorkoutState';
import { PlatesCalculator } from '@features/workout/components/PlatesCalculator';
import {
  WorkoutSavedCard,
  type WorkoutSummary,
} from '@features/workout/components/WorkoutSavedCard';
import type { ExerciseNote, PersonalRecord } from '@shared/lib/types';
import { isSetRowIntended, selectSetsForSave } from '@features/workout/lib/setValidation';
import { toast } from 'sonner';
import { impact, notificationHaptic, ImpactStyle, NotificationType } from '@shared/lib/haptics';
import { celebrate } from '@shared/lib/celebration';
import { playSuccessChime } from '@shared/lib/alarm';
import { devError } from '@shared/lib/devtools';
import { Calculator, ChevronDown, Trophy } from '@shared/components/icons';

const containerVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function WorkoutPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
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
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('error');
  const [copyConfirm, setCopyConfirm] = useState<{ reps: number; weight: number }[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [setErrors, setSetErrors] = useState<Record<number, string>>({});
  /** Serie que la lista debe abrir por orden de la pantalla (guardado fallido). */
  const [focusSet, setFocusSet] = useState<{ index: number; nonce: number } | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [showPlates, setShowPlates] = useState(false);
  const [saveDialog, setSaveDialog] = useState<{
    completedCount: number;
    pendingCount: number;
  } | null>(null);
  const [completed, setCompleted] = useState<WorkoutSummary | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(() => {
    if (startedAt && sets.length > 0) {
      return Date.now() - new Date(startedAt).getTime() < 12 * 60 * 60 * 1000;
    }
    return false;
  });

  // El gesto de atrás (Android) cierra las hojas antes de intentar navegar.
  useEffect(() => {
    if (!showRating) return;
    return registerBackAction('workout-rating', () => setShowRating(false));
  }, [showRating]);

  useEffect(() => {
    if (!showPlates) return;
    return registerBackAction('workout-plates', () => setShowPlates(false));
  }, [showPlates]);

  // Sin esto, el gesto de atrás sobre el diálogo de guardado navegaba fuera de
  // la pantalla y dejaba la sesión a medias. Cerrar equivale a cancelar: no
  // guarda y no fija preferencia.
  useEffect(() => {
    if (!saveDialog) return;
    return registerBackAction('workout-save-dialog', () => setSaveDialog(null));
  }, [saveDialog]);

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

  /**
   * ¿Hay ya alguna serie dada por hecha en esta sesión?
   *
   * Es lo que separa «estoy decidiendo el peso» de «estoy registrando»: en el
   * primer caso el contexto (última sesión + recomendación) es lo que hay que
   * ver; en el segundo, el teclado.
   */
  const haySerieHecha = sets.some((s) => s.completed);

  /**
   * Si el contexto está desplegado.
   *
   * Va **derivado** y no en un efecto: por defecto abierto mientras no haya una
   * serie hecha y plegado en cuanto la hay, con lo que el cambio de ejercicio lo
   * reabre solo (otra decisión de peso, otra clave). Lo único que se guarda es
   * la decisión explícita del usuario, y solo vale para el ejercicio en el que
   * la tomó.
   */
  const [contextoManual, setContextoManual] = useState<{ ex: string | null; abierto: boolean }>({
    ex: null,
    abierto: true,
  });
  const contextoAbierto =
    contextoManual.ex === (activeExerciseId ?? null) ? contextoManual.abierto : !haySerieHecha;
  const abrirContexto = (abierto: boolean) =>
    setContextoManual({ ex: activeExerciseId ?? null, abierto });
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
    // Fecha local: con la de UTC, entrenar de madrugada usaba el peso de ayer
    // aunque el de hoy ya estuviera apuntado.
    () => bodyWeightAtDate(bodyMeasurements, toLocalDateKey(new Date())),
    [bodyMeasurements],
  );
  const isBodyweightExercise = isBodyweightLoad(selectedExercise?.load_type);

  // Sugerencia de carga del motor determinista para el ejercicio activo.
  //
  // El rango de reps objetivo va por el resolutor compartido, igual que en la
  // sesión de rutina: sin él esta pantalla caía al [8, 12] por defecto de
  // `suggestProgression` y recomendaba un peso distinto para el mismo ejercicio.
  const activeExerciseName = selectedExercise?.name || customExerciseName;
  const { repMin, repMax } = useExerciseRepRange(activeExerciseName);
  const exerciseAdvice = useExerciseAdvice(user?.id, activeExerciseId ?? undefined, {
    repMin,
    repMax,
    bodyweight: isBodyweightExercise,
    muscleGroup: selectedExercise?.muscle_group ?? undefined,
    equipment: selectedExercise?.equipment ?? null,
  });

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

  // Día de la semana para el titular «Rutina · Lunes».
  const weekdayName = useMemo(() => format(new Date(), 'EEEE', { locale: es }), []);

  // Filas que el usuario ha escrito de verdad y que se pueden guardar. Los
  // contadores de la pantalla salen de aquí y no del array crudo: una fila a
  // medias no suma, y una mal escrita vuelve en `errors` para pintarla en rojo
  // en vez de desaparecer al guardar.
  const setSelection = useMemo(() => selectSetsForSave(sets), [sets]);

  // En modo peso corporal el kg introducido es lastre; el peso efectivo por rep
  // es (peso corporal vigente + lastre), igual que lo que se guarda en saveWorkout.
  const sessionVolume = useMemo(
    () =>
      setSelection.selected.reduce((sum, s) => {
        const w = isBodyweightExercise ? (currentBodyWeight ?? 0) + s.weightKg : s.weightKg;
        return sum + (s.reps ?? 0) * w;
      }, 0),
    [setSelection, isBodyweightExercise, currentBodyWeight],
  );

  const validSetCount = setSelection.selected.length;

  // Mejor 1RM estimado de la sesión (excluye calentamientos). Pesos en kg.
  const bestEstimate = useMemo(() => {
    let best: { weightKg: number; e1rm: number } | null = null;
    for (const s of setSelection.selected) {
      if (sets[s.index]?.isWarmup) continue;
      const w = s.weightKg;
      const r = s.reps;
      if (r == null || w <= 0) continue;
      const e1rm = calcular1RM(w, r);
      if (!best || e1rm > best.e1rm) best = { weightKg: w, e1rm };
    }
    return best;
  }, [setSelection, sets]);

  const checkIsNewPR = useCallback(
    (weight: string, reps: string): boolean => {
      if (!currentPR) return false;
      const current1RM =
        currentPR.one_rm || calcular1RM(Number(currentPR.weight) || 0, Number(currentPR.reps) || 0);
      return calcular1RM(Number(weight) || 0, Number(reps) || 0) > current1RM;
    },
    [currentPR],
  );

  /**
   * Guarda el entreno.
   *
   * `scope` presente = alcance ya decidido (es lo que pasan las dos ramas del
   * diálogo). Sin `scope` hay que resolverlo, y puede acabar en preguntar.
   *
   * Antes esto era un único `onlyCompleted?: boolean`, y ese flag significaba a
   * la vez «qué series guardar» y «aún no he preguntado». La confirmación no
   * tenía forma de decir «guardar todas, ya está decidido»: volvía a entrar con
   * `false`, el guard se cumplía otra vez y el diálogo se reabría en bucle.
   * «Guardar todas» no llegaba a guardar nunca.
   */
  const handleSave = async (opts: { scope?: SaveScope } = {}) => {
    if (!user || saving) return;

    let scope = opts.scope;
    if (!scope) {
      const completedCount = sets.filter((s) => s.completed).length;
      // Pendientes = filas válidas sin ✓. Una fila mal escrita no entra aquí:
      // se abre al guardar, con su motivo.
      const pendingCount = setSelection.selected.filter((s) => !sets[s.index].completed).length;
      const decision = resolveSaveScope({
        completedCount,
        pendingCount,
        stored: readSaveScope(),
      });
      if (decision === 'ask') {
        setSaveDialog({ completedCount, pendingCount });
        return;
      }
      scope = decision;
    }

    const onlyCompleted = scope === 'completed-only';
    setMessage('');

    // La misma función que usa el store: si aquí pasara una fila y allí no, el
    // guardado diría «no hay series válidas» sobre lo que la pantalla dio por
    // bueno. Eso era exactamente lo que pasaba con las series sin lastre.
    const { selected, errors } = selectSetsForSave(sets, { onlyCompleted });
    setSetErrors(errors);

    const failed = Object.keys(errors).map(Number);
    if (failed.length > 0) {
      void notificationHaptic(NotificationType.Error);
      // El error de cada fila solo se pintaba en la serie que estuviera abierta,
      // así que si la rota era otra el botón no hacía nada y no lo decía nadie:
      // parecía que Guardar estuviese muerto. Ahora se nombran las series.
      setMessage(
        t('workout.errors.sets_incomplete', {
          count: failed.length,
          numbers: failed.map((i) => i + 1).join(', '),
        }),
      );
      setMessageTone('error');
      // Y se abre la primera que falla, para que el campo grande muestre ya
      // la serie que hay que arreglar. El contador hace que dos intentos
      // seguidos sobre la misma serie vuelvan a abrirla.
      setFocusSet((prev) => ({ index: failed[0], nonce: (prev?.nonce ?? 0) + 1 }));
      return;
    }
    if (!selected.length) {
      setMessage(t('workout.add_valid_set'));
      setMessageTone('error');
      return;
    }

    // saveWorkout limpia la sesión: hay que quedarse con el resumen antes.
    const summaryMinutes = startedAt
      ? Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000))
      : 0;
    const summarySets = onlyCompleted
      ? selected.filter((s) => sets[s.index].completed).length
      : selected.length;
    const summaryVolume = `${convert(sessionVolume).toFixed(0)} ${weightUnit}`;

    setSaving(true);
    // Contexto explícito: el del store se actualiza en un efecto y puede ir un
    // ejercicio por detrás justo al cambiar y guardar.
    const result = await saveWorkout(user.id, {
      onlyCompleted,
      bodyweight: isBodyweightExercise,
      bodyWeightKg: currentBodyWeight,
    });
    setSaving(false);

    // El store vuelve a validar sobre el estado más reciente. Si hay filas que
    // no pasan, se abren aquí; nunca se guarda «lo que se pueda» en silencio.
    if (result.setErrors && Object.keys(result.setErrors).length > 0) {
      setSetErrors(result.setErrors);
      const first = Number(Object.keys(result.setErrors)[0]);
      setFocusSet((prev) => ({ index: first, nonce: (prev?.nonce ?? 0) + 1 }));
    }

    // Progresión automática: con la sesión guardada (o encolada), avanza el
    // ciclo del ejercicio con su mejor serie. El peso del store está en kg.
    const recordProgression = () => {
      const name = selectedExercise?.name || customExerciseName.trim();
      if (!name) return;
      const valid = selected
        .filter((s) => s.reps != null && s.reps > 0)
        // Una serie a 0 kg en un ejercicio con carga externa no dice nada del
        // peso que toca la próxima vez: proponer 0 sería peor que no proponer.
        .filter((s) => isBodyweightExercise || s.weightKg > 0)
        .map((s) => ({ reps: s.reps as number, weight: s.weightKg }));
      if (valid.length === 0) return;
      const top = valid.reduce((a, b) =>
        b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a,
      );
      // El escalón sale de los discos que el usuario tiene en su gimnasio: 2,5 kg
      // fijos proponían pesos que en su sala no se pueden montar.
      const loadStepKg = loadStepFromSettings(selectedExercise?.equipment);
      useProgressionStore.getState().recordSession(
        name,
        { ...top, sessionReps: valid.map((s) => s.reps) },
        {
          repMin,
          repMax,
          bodyweight: isBodyweightExercise,
          incrementKg: loadStepKg,
        },
      );
      void useProgressionStore.getState().saveToDb(user.id);
    };

    if (result.error) {
      // El store manda claves de i18n; `t` devuelve el texto tal cual si lo que
      // llega es el mensaje de un error de red, así que sirve para los dos.
      const texto = t(result.error.message);
      setMessage(texto);
      setMessageTone('error');
      toast.error(texto);
    } else if (result.queued) {
      // Guardado offline: se sincronizará al volver la conexión.
      recordProgression();
      setSaveSuccess(true);
      setMessage(t('workout.saved_offline'));
      setMessageTone('success');
      toast.success(t('workout.saved_offline'));
      void notificationHaptic(NotificationType.Success);
      setTimeout(() => setMessage(''), 2500);
      setTimeout(() => setSaveSuccess(false), 300);
    } else {
      setSaveSuccess(true);
      setMessage(t('workout.saved'));
      setMessageTone('success');
      toast.success(t('workout.saved'));
      void notificationHaptic(NotificationType.Success);
      if (sound) playSuccessChime();
      recordProgression();
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
      for (const s of selected) {
        if (s.reps == null || s.weightKg <= 0) continue;
        const e1rm = Math.round(calcular1RM(s.weightKg, s.reps));
        if (e1rm > max1RM && checkIsNewPR(String(s.weightKg), String(s.reps))) {
          max1RM = e1rm;
        }
      }

      let prLabel: string | undefined;
      if (max1RM > 0) {
        celebrate();
        void notificationHaptic(NotificationType.Success);
        const exerciseName = selectedExercise?.name || customExerciseName || 'Ejercicio';
        prLabel = `Nuevo PR: ${exerciseName} - ${convert(max1RM).toFixed(1)} ${weightUnit}`;
        setMessage(prLabel);
        setMessageTone('success');
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

  /**
   * Respuesta al diálogo: se recuerda la elección y se guarda con ella. A
   * partir de aquí el diálogo no vuelve a salir salvo que se pida desde Ajustes.
   */
  const chooseSaveScope = (scope: SaveScope) => {
    writeSaveScope(scope);
    setSaveDialog(null);
    void handleSave({ scope });
  };

  const handleAddSet = useCallback(() => {
    void impact(ImpactStyle.Light);
    const lastSet = sets.at(-1);
    // Cuenta como serie hecha si el usuario la escribió, aunque no lleve peso
    // (gemelos a una pierna, dominadas): antes ese caso no arrancaba descanso.
    const lastHasData = lastSet ? isSetRowIntended(lastSet) : false;
    addSet();
    if (restAutoStart && lastHasData && !restTimerRunning && defaultRest > 0) {
      // Ejercicios compuestos descansan más (≈2×), capado a 10 min.
      const rest =
        restByExercise && selectedExercise?.is_compound
          ? Math.min(defaultRest * 2, 600)
          : defaultRest;
      startRestTimer(rest);
    }
  }, [
    sets,
    addSet,
    restAutoStart,
    restTimerRunning,
    defaultRest,
    restByExercise,
    selectedExercise,
    startRestTimer,
  ]);

  /**
   * Cómo se registra el ejercicio activo: repeticiones o tiempo.
   *
   * Es estado de pantalla y no del store porque **vuelve a `reps` al cambiar de
   * ejercicio**: dejar el cronómetro puesto al pasar de la plancha al press
   * banca invitaba a registrar una serie de fuerza sin repeticiones.
   */
  const [loggingMode, setLoggingMode] = useState<'reps' | 'time'>('reps');

  // Ajuste durante el render, no en un efecto: es el patron que React documenta
  // para «resetear estado cuando cambia una entrada». Con `useEffect` el modo
  // viejo llegaria a pintarse un fotograma —el cronometro parpadeando sobre el
  // ejercicio nuevo— y ademas encadena un render de mas.
  const exerciseKey = activeExerciseId ?? customExerciseName;
  const [prevExerciseKey, setPrevExerciseKey] = useState(exerciseKey);
  if (prevExerciseKey !== exerciseKey) {
    setPrevExerciseKey(exerciseKey);
    setLoggingMode('reps');
  }

  const applyCopiedSets = useCallback(
    (copied: { reps: number; weight: number }[]) => {
      setSets(
        copied.map((s) => ({
          id: crypto.randomUUID(),
          reps: String(s.reps),
          weight: String(s.weight),
          durationSeconds: '',
          notes: '',
          isWarmup: false,
          rpe: '',
          setType: 'normal' as const,
          completed: false,
          // Copiadas a propósito por el usuario: son suyas desde el minuto uno.
          autofilled: false,
        })),
      );
      void impact(ImpactStyle.Light);
    },
    [setSets],
  );

  /**
   * «Copiar» de la última sesión **reemplaza** el array de series, no lo añade.
   * Con series ya anotadas eso las borraba en silencio y sin deshacer, en un
   * botón que no se lee como destructivo. Si hay algo escrito de verdad —una
   * fila con reps o peso, no la fila vacía inicial— se pregunta antes.
   */
  const handleCopySets = useCallback(
    (copied: { reps: number; weight: number }[]) => {
      if (!copied.length) return;
      const hasRealData = sets.some((s) => s.reps.trim() !== '' || s.weight.trim() !== '');
      if (hasRealData) {
        setCopyConfirm(copied);
        return;
      }
      applyCopiedSets(copied);
    },
    [sets, applyCopiedSets],
  );

  // «Aplicar» de la tarjeta de sugerencia: rellena la serie en curso con el peso
  // y reps recomendados (en kg, como guarda el store). Cada serie nueva hereda
  // el valor de la anterior, así que basta con tocar la última.
  const handleApplyAdvice = useCallback(
    (suggestion: LoadSuggestion) => {
      const weight = String(suggestion.weight);
      const reps = String(suggestion.reps);
      if (sets.length === 0) {
        addSet();
        updateSet(0, { weight, reps });
      } else {
        updateSet(sets.length - 1, { weight, reps });
      }
      void impact(ImpactStyle.Light);
    },
    [sets.length, addSet, updateSet],
  );

  const handleSaveNote = useCallback(
    async (text: string) => {
      if (!user || !activeExerciseId || !text) return;
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
    },
    [user, activeExerciseId, queryClient, t],
  );

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
        queryClient.invalidateQueries({ queryKey: ['exerciseLibrary'] });
        setActiveExercise(null);
        toast.success(t('workout.delete_exercise_done'));
      } catch (err) {
        devError('Error deleting exercise:', err);
        // `workout_sets.exercise_id` es ON DELETE RESTRICT: un ejercicio con
        // series guardadas no se puede borrar, y Postgres devuelve 23503.
        // Hasta ahora el error solo iba a la consola de desarrollo, así que en
        // la app el usuario tocaba la papelera y no pasaba absolutamente nada
        // —ni se borraba ni se le decía por qué—.
        const code = (err as { code?: string } | null)?.code;
        toast.error(
          code === '23503'
            ? t('workout.delete_exercise_in_use')
            : t('workout.delete_exercise_failed'),
        );
      }
    },
    [queryClient, setActiveExercise, t],
  );

  return (
    <Layout>
      <AnimatePresence>
        {completed && <WorkoutSavedCard summary={completed} onDismiss={() => setCompleted(null)} />}
      </AnimatePresence>

      {/* Solo aparece si se ha llegado aquí desde «Aplicar» en el entrenador. */}
      <CoachSuggestionBanner />

      {/* Con sesión en marcha la pantalla es para entrenar: el recordatorio
          semanal de peso puede esperar a que se guarde. La tarjeta de salud del
          wearable ya era solo-reposo por el mismo motivo. */}
      {isIdle && <WeeklyWeightPrompt />}
      <AnimatePresence>
        {showResumeBanner && startedAt && (
          <ResumeWorkoutBanner
            setCount={sets.length}
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
        <RoutineDayHeader
          name={todayRoutine.name}
          weekdayName={weekdayName}
          isIdle={isIdle}
          exercises={todayRoutine.exercises}
          variants={containerVariants}
        />
      )}

      {user && (
        <ExercisePicker
          userId={user.id}
          activeExerciseId={activeExerciseId}
          exerciseName={selectedExercise?.name || customExerciseName || ''}
          canDelete={!!selectedExercise?.user_id}
          notes={exerciseNotes}
          onSelect={(id) => {
            setActiveExercise(id);
            if (!sets.length) addSet();
          }}
          onDeleteExercise={() => selectedExercise && handleDeleteExercise(selectedExercise.id)}
          onSaveNote={handleSaveNote}
          onDeleteNote={handleDeleteNote}
        >
          {/* Contexto para decidir el peso: qué se hizo la última vez y qué
              recomienda el motor.
              Se pliega solo en cuanto hay una serie hecha. No es que estorbe
              —es justo lo que hay que ver antes de la primera— sino que después
              ya no se decide nada: el peso está en la barra y lo que se necesita
              en pantalla es el teclado, que con estas dos tarjetas desplegadas
              quedaba por debajo de todo. Se vuelve a abrir tocando el resumen. */}
          {activeExerciseId &&
            (contextoAbierto ? (
              <>
                <LastSessionCard
                  userId={user.id}
                  exerciseId={activeExerciseId}
                  onCopySets={handleCopySets}
                />

                {exerciseAdvice && (
                  <div className="mt-3">
                    <NextSessionCard
                      advice={{
                        ...exerciseAdvice,
                        exercise: selectedExercise?.name ?? customExerciseName ?? '',
                      }}
                      onApply={handleApplyAdvice}
                    />
                  </div>
                )}

                {haySerieHecha && (
                  <button
                    type="button"
                    onClick={() => abrirContexto(false)}
                    className="label-caps mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 text-fg-subtle active:opacity-60"
                  >
                    <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
                    {t('workout.context_hide')}
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => abrirContexto(true)}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-sm bg-surface-2 px-3 text-left active:bg-hover"
              >
                <span className="label-caps text-fg-muted">
                  {exerciseAdvice
                    ? `${t('coach.next_label')} · ${formatWeightInput(
                        convert(exerciseAdvice.suggestion.weight),
                      )} ${weightUnit} × ${exerciseAdvice.suggestion.reps}`
                    : t('workout.context_show')}
                </span>
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-fg-subtle" aria-hidden="true" />
              </button>
            ))}
        </ExercisePicker>
      )}

      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.25, ease: 'easeOut', delay: 0.1 }}
        className={saveSuccess ? 'success-pulse' : ''}
      >
        {selectedExercise && (
          <ExerciseLoadType
            exerciseId={selectedExercise.id}
            exerciseName={selectedExercise.name}
            loadType={(selectedExercise.load_type as LoadType | undefined) ?? 'external'}
            equipment={selectedExercise.equipment}
          />
        )}

        {sets.length === 0 ? (
          <EmptyWorkoutState
            onAddSet={addSet}
            lastWorkout={lastWorkout}
            onRepeatLast={() => {
              if (lastWorkout) repeatWorkout(lastWorkout);
            }}
          />
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
              // `||` y no `??`: sin ejercicio elegido `customExerciseName` es
              // cadena vacía, y con `??` el titular desaparecía y «SERIE n» se
              // quedaba solo a la izquierda (visto en el emulador).
              exerciseName={selectedExercise?.name || customExerciseName || t('workout.sets')}
              showWarmupSets={showWarmupSets}
              setErrors={setErrors}
              setSetErrors={setSetErrors}
              updateSet={updateSet}
              removeSet={removeSet}
              onCommitSet={handleAddSet}
              checkIsNewPR={checkIsNewPR}
              weightUnit={weightUnit}
              convert={convert}
              convertToKg={convertToKg}
              loggingMode={loggingMode}
              onLoggingModeChange={setLoggingMode}
              focusSet={focusSet}
            />

            {/* Chips de la maqueta: calculadora de discos, 1RM estimado y notas
                del ejercicio. Sustituyen a la cabecera con el récord suelto: la
                misma información, pero pulsable y en su sitio. */}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowPlates(true)}
                className="label-caps flex min-h-11 items-center gap-2 rounded-sm bg-surface-2 px-3 text-fg-muted transition-colors active:bg-hover"
              >
                <Calculator className="h-4 w-4 text-accent" />
                {t('workout.plates_calc_short')}
              </button>
              {bestEstimate && (
                <span className="label-caps flex min-h-11 items-center gap-2 rounded-sm bg-surface-2 px-3 text-fg-muted">
                  <Trophy className="h-4 w-4 text-accent" aria-hidden="true" />
                  {t('workout.e1rm')} {convert(bestEstimate.e1rm).toFixed(1)} {weightUnit}
                </span>
              )}
            </div>

            {/* Récords por banda de reps: no salen en la maqueta pero son datos
                reales, así que se quedan debajo, en tono apagado. */}
            {(currentPR || currentPRs.length > 1) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                {currentPR && (
                  <span className="label-caps text-accent">
                    {t('workout.recent_pr')} {convert(Number(currentPR.weight)).toFixed(1)}{' '}
                    {weightUnit} × {currentPR.reps}
                  </span>
                )}
                {currentPRs.length > 1 &&
                  currentPRs.map((pr) => (
                    <span
                      key={pr.rep_band}
                      className="label-caps tabular text-fg-subtle"
                      title={t('workout.pr_by_band')}
                    >
                      {pr.rep_band === 15 ? '15+' : pr.rep_band}r ·{' '}
                      {convert(Number(pr.weight)).toFixed(0)}
                      {weightUnit}
                    </span>
                  ))}
              </div>
            )}
          </>
        )}
      </m.div>

      {sets.length > 0 && (
        <WorkoutActionBar
          message={message}
          messageTone={messageTone}
          saving={saving}
          saveSuccess={saveSuccess}
          canRemoveAll={sets.length > 1}
          hasRating={sessionRating !== null}
          hasNotes={!!sessionNotes}
          onAddSet={handleAddSet}
          onRemoveAll={removeAllSets}
          onOpenRating={() => setShowRating(true)}
          onSave={handleSave}
        />
      )}

      <AnimatePresence>
        {showRating && (
          <SessionRatingSheet
            rating={sessionRating}
            notes={sessionNotes}
            onRate={setSessionRating}
            onNotes={setSessionNotes}
            onClose={() => setShowRating(false)}
          />
        )}
      </AnimatePresence>

      <RestTimer />

      {/* Atajo al entrenador IA, solo en reposo: con la sesión en marcha la
          pantalla es para anotar series, no para irse a otra pantalla. Se
          esconde solo si el entrenador está apagado. */}
      {isIdle && <CoachHomeCard />}

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

      <ConfirmDialog
        open={!!saveDialog}
        title={t('workout.save_pending_title')}
        description={
          saveDialog &&
          t('workout.save_pending_body', {
            completed: saveDialog.completedCount,
            pending: saveDialog.pendingCount,
          })
        }
        confirmLabel={t('workout.save_all')}
        cancelLabel={t('workout.save_completed_only')}
        variant="default"
        onConfirm={() => chooseSaveScope('all')}
        onCancel={() => chooseSaveScope('completed-only')}
      />

      <ConfirmDialog
        open={!!copyConfirm}
        title={t('workout.copy_replace_title')}
        description={t('workout.copy_replace_body')}
        confirmLabel={t('workout.copy_replace_accept')}
        onConfirm={() => {
          if (copyConfirm) applyCopiedSets(copyConfirm);
          setCopyConfirm(null);
        }}
        onCancel={() => setCopyConfirm(null)}
      />
    </Layout>
  );
}
