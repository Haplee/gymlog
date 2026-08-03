import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { useRoutineSessionStore } from '@features/routine/stores/routineSessionStore';
import { useWeight } from '@shared/hooks/useWeight';
import { impact, notificationHaptic, ImpactStyle, NotificationType } from '@shared/lib/haptics';
import { celebrate } from '@shared/lib/celebration';
import { fetchExerciseLibrary } from '@shared/api/queries';
import { weightToInput } from '@shared/lib/weight';
import type { Exercise } from '@shared/lib/types';
import type { ExerciseAdvice } from '@features/stats/hooks/useAutoregulation';
import { SessionExerciseCard } from './SessionExerciseCard';

interface Props {
  userId: string;
  /** Catálogo cacheado (propios + públicos) para mapear nombre → exercise_id. */
  exercises: Exercise[];
}

// Nombre normalizado: minúsculas y sin acentos. Las rutinas predefinidas usan
// «bíceps», «tríceps», etc.; el catálogo guarda el nombre tal cual lo creó el
// usuario. Sin esta normalización un acento distinto rompería el emparejado.
const normalizeName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function RoutineSession({ userId, exercises }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { unit: weightUnit, toKg } = useWeight();

  const routineName = useRoutineSessionStore((s) => s.routineName);
  const dayName = useRoutineSessionStore((s) => s.dayName);
  const sessionExercises = useRoutineSessionStore((s) => s.exercises);
  const saving = useRoutineSessionStore((s) => s.saving);
  const { discard, setExercises, finish } = useRoutineSessionStore(
    useShallow((s) => ({
      discard: s.discard,
      setExercises: s.setExercises,
      finish: s.finish,
    })),
  );

  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Recomendación de cada ejercicio, reportada por su tarjeta: al pulsar
  // «Completar» se rellena el peso en todas las series sin que el usuario
  // teclee nada. El ref evita que el flujo dependa del estado de React.
  const adviceByName = useRef(new Map<string, ExerciseAdvice>());
  const registerAdvice = useCallback((name: string, advice: ExerciseAdvice | null) => {
    if (advice) adviceByName.current.set(normalizeName(name), advice);
    else adviceByName.current.delete(normalizeName(name));
  }, []);

  // Fichas de la biblioteca (propios + públicos): aportan la descripción de la
  // forma/ejecución por ejercicio. Reutiliza la caché de la pantalla Biblioteca.
  const { data: library = [] } = useQuery({
    queryKey: ['exerciseLibrary', userId],
    queryFn: () => fetchExerciseLibrary(userId),
    staleTime: 1000 * 60 * 5,
  });

  // Mapeo por nombre normalizado: la rutina guarda nombres, la BD necesita ids.
  const resolveExerciseId = useCallback(
    (name: string): string | null => {
      return exercises.find((e) => normalizeName(e.name) === normalizeName(name))?.id ?? null;
    },
    [exercises],
  );

  const catalogByName = useMemo(
    () => new Map(exercises.map((e) => [normalizeName(e.name), e])),
    [exercises],
  );
  const libraryByName = useMemo(
    () => new Map(library.map((e) => [normalizeName(e.name), e])),
    [library],
  );

  const handleFinish = async () => {
    // Autocompletado: se rellena el peso recomendado en todas las series de los
    // ejercicios que tienen recomendación. Los que no la tienen (sin historial)
    // se muestran informativos pero se quedan fuera del registro.
    const withWeights = sessionExercises.map((ex) => {
      const advice = adviceByName.current.get(normalizeName(ex.name));
      if (!advice) return ex;
      const weight = weightToInput(advice.suggestion.weight, weightUnit);
      return { ...ex, sets: ex.sets.map((s) => ({ ...s, weight })) };
    });

    if (withWeights.every((ex) => ex.sets.every((s) => !s.weight.trim()))) {
      void notificationHaptic(NotificationType.Error);
      toast.error(t('routine.session_no_advice'));
      return;
    }

    setExercises(withWeights);
    const result = await finish(userId, resolveExerciseId, toKg);

    if (result.error) {
      void notificationHaptic(NotificationType.Error);
      toast.error(result.error.message);
      return;
    }
    if (!result.success) return;

    // refetchType: 'all' — HistoryPage/StatsPage pueden no estar montadas y el
    // cliente global usa refetchOnMount: false.
    queryClient.invalidateQueries({ queryKey: ['workouts'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['recentSets'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['workoutsAndSets'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['personalRecords'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['lastWorkoutFull'], refetchType: 'all' });

    void notificationHaptic(NotificationType.Success);
    celebrate();
    toast.success(result.queued ? t('routine.session_saved_offline') : t('routine.session_saved'));
    navigate('/history');
  };

  return (
    <div className="rounded-card p-4 bg-surface border border-line-accent shadow-card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="label-caps text-accent">{t('routine.session_in_progress')}</div>
          <div className="text-data font-display font-bold text-fg truncate">{dayName}</div>
          <div className="text-xs text-fg-subtle truncate">{routineName}</div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmDiscard(true)}
          className="flex-shrink-0 min-h-11 label-caps px-3 py-1.5 rounded-pill bg-surface-2 border border-line text-fg-subtle"
        >
          {t('routine.session_discard')}
        </button>
      </div>

      <div className="space-y-3">
        {sessionExercises.map((ex) => (
          <SessionExerciseCard
            key={ex.name}
            userId={userId}
            exercise={ex}
            catalog={catalogByName.get(normalizeName(ex.name))}
            libraryExercise={libraryByName.get(normalizeName(ex.name))}
            weightUnit={weightUnit}
            onAdvice={registerAdvice}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          void impact(ImpactStyle.Light);
          handleFinish();
        }}
        disabled={saving}
        className="mt-4 w-full min-h-12 rounded-pill text-sm font-display font-bold uppercase tracking-[0.12em] bg-accent text-accent-fg shadow-btn-accent active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        {saving ? t('routine.session_saving') : t('routine.session_finish')}
      </button>

      {confirmDiscard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="rounded-card p-4 w-full max-w-sm bg-surface border border-line">
            <div className="text-sm text-fg mb-4">{t('routine.session_discard_confirm')}</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="flex-1 min-h-11 rounded-pill text-sm bg-surface-2 text-fg-muted"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  discard();
                  setConfirmDiscard(false);
                }}
                className="flex-1 min-h-11 rounded-pill text-sm font-semibold bg-error text-white"
              >
                {t('routine.session_discard')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
