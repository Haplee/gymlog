import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { useRoutineSessionStore } from '@features/routine/stores/routineSessionStore';
import { useProgressionStore } from '@features/routine/stores/progressionStore';
import { useWeight } from '@shared/hooks/useWeight';
import { impact, notificationHaptic, ImpactStyle, NotificationType } from '@shared/lib/haptics';
import { loadStepFromSettings } from '@shared/hooks/useLoadStep';
import { celebrate } from '@shared/lib/celebration';
import { fetchExerciseLibrary } from '@shared/api/queries';
import { weightToInput } from '@shared/lib/weight';
import { normalizeExerciseName, parseRepRange } from '@shared/lib/progressionCycle';
import { isBodyweightLoad } from '@shared/lib/loadType';
import type { Exercise } from '@shared/lib/types';
import type { ExerciseAdvice } from '@features/stats/hooks/useAutoregulation';
import { SessionExerciseCard } from './SessionExerciseCard';
import { groupPlanExercises } from '@features/routine/utils/planTarget';

interface Props {
  userId: string;
  /** Catálogo cacheado (propios + públicos) para mapear nombre → exercise_id. */
  exercises: Exercise[];
}

// Nombre normalizado: minúsculas y sin acentos. Las rutinas predefinidas usan
// «bíceps», «tríceps», etc.; el catálogo guarda el nombre tal cual lo creó el
// usuario. Sin esta normalización un acento distinto rompería el emparejado.
const normalizeName = normalizeExerciseName;

export function RoutineSession({ userId, exercises }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { unit: weightUnit, toKg } = useWeight();

  const routineName = useRoutineSessionStore((s) => s.routineName);
  const dayName = useRoutineSessionStore((s) => s.dayName);
  const sessionExercises = useRoutineSessionStore((s) => s.exercises);
  const saving = useRoutineSessionStore((s) => s.saving);
  const { discard, finish, prefillAdvisedWeight } = useRoutineSessionStore(
    useShallow((s) => ({
      discard: s.discard,
      finish: s.finish,
      prefillAdvisedWeight: s.prefillAdvisedWeight,
    })),
  );

  const [confirmDiscard, setConfirmDiscard] = useState(false);

  /**
   * El cronómetro entrega los segundos de **una** serie, y se escriben en la
   * primera que aún no tenga tiempo propio del usuario.
   *
   * Se recorren en orden en vez de rellenar todas de golpe porque las series de
   * una plancha no duran lo mismo: la cuarta siempre cae respecto a la primera,
   * y eso es justo lo que interesa registrar.
   */
  const registerDuration = useCallback((name: string, seconds: number) => {
    const store = useRoutineSessionStore.getState();
    const exIndex = store.exercises.findIndex((e) => normalizeName(e.name) === normalizeName(name));
    if (exIndex < 0) return;

    const sets = store.exercises[exIndex].sets;
    const objetivo = store.exercises[exIndex].targetDurationSeconds;
    // «Aún sin tiempo propio» = vacía, o con el valor precargado del plan.
    const libre = sets.findIndex(
      (s) =>
        !s.durationSeconds.trim() || (objetivo != null && s.durationSeconds === String(objetivo)),
    );
    const destino = libre >= 0 ? libre : sets.length - 1;

    store.updateSet(exIndex, destino, { durationSeconds: String(seconds) });
    void impact(ImpactStyle.Light);
  }, []);

  /**
   * Recomendación de cada ejercicio, reportada por su tarjeta.
   *
   * Antes se guardaba para machacar con ella **todas** las series al pulsar
   * «Completar», y lo que acababa en el historial era la propuesta de la app en
   * vez del entrenamiento. Ahora se escribe en la fila en cuanto llega, donde se
   * ve y se puede corregir: seguir sin teclear nada es igual de rápido, pero lo
   * que se guarda es lo que hay en la fila.
   */
  const adviceByName = useRef(new Map<string, ExerciseAdvice>());
  const registerAdvice = useCallback(
    (name: string, advice: ExerciseAdvice | null) => {
      const key = normalizeName(name);
      if (!advice) {
        adviceByName.current.delete(key);
        return;
      }
      adviceByName.current.set(key, advice);
      prefillAdvisedWeight(name, weightToInput(advice.suggestion.weight, weightUnit));
    },
    [prefillAdvisedWeight, weightUnit],
  );

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
    // Lo que se guarda es lo que hay en las filas: ya vienen precargadas con el
    // objetivo del plan y el peso recomendado, y con lo que el usuario haya
    // corregido encima. Aquí no se reescribe nada.
    const withWeights = sessionExercises;

    // Hay algo que registrar si alguna serie tiene peso **o** duración. Antes
    // solo se miraba el peso, y una sesión de solo planchas —que no lleva
    // ninguno— se rechazaba diciendo que no había recomendaciones.
    const hayAlgoQueRegistrar = withWeights.some((ex) =>
      ex.sets.some((s) => s.weight.trim() || s.durationSeconds.trim()),
    );
    if (!hayAlgoQueRegistrar) {
      void notificationHaptic(NotificationType.Error);
      toast.error(t('routine.session_no_advice'));
      return;
    }

    const result = await finish(userId, resolveExerciseId, toKg);

    if (result.error) {
      void notificationHaptic(NotificationType.Error);
      toast.error(result.error.message);
      return;
    }
    if (!result.success) return;

    // Progresión automática: con la sesión ya guardada, avanza el ciclo de cada
    // ejercicio con su mejor serie. El store lo persiste y sincroniza solo.
    const progression = useProgressionStore.getState();
    for (const ex of withWeights) {
      const valid = ex.sets
        .map((s) => ({ reps: Number(s.reps), weight: toKg(Number(s.weight)) }))
        .filter((s) => Number.isFinite(s.weight) && Number.isFinite(s.reps) && s.reps > 0);
      if (valid.length === 0) continue;
      const top = valid.reduce((a, b) =>
        b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a,
      );
      const { repMin, repMax } = parseRepRange(ex.targetReps);
      const catalog = catalogByName.get(normalizeName(ex.name));
      // `sessionReps` va con todas las series, no solo la mejor: subir el peso
      // porque la primera serie llegó al techo es lo que hacía que la carga
      // creciera cada semana sin haber completado el esquema.
      progression.recordSession(
        ex.name,
        { ...top, sessionReps: valid.map((s) => s.reps) },
        {
          repMin,
          repMax,
          bodyweight: isBodyweightLoad(catalog?.load_type),
          // El escalón es del ejercicio, no de la sesión: la sentadilla salta lo
          // que den los discos y la polea lo que salte su columna de placas.
          incrementKg: loadStepFromSettings(catalog?.equipment),
        },
      );
    }
    void progression.saveToDb(userId);

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
        {groupPlanExercises(sessionExercises).map((grupo) => {
          const tarjetas = grupo.exercises.map((ex, i) => (
            <SessionExerciseCard
              key={ex.name}
              userId={userId}
              exercise={ex}
              // `indices` guarda la posición original en la sesión, que es lo
              // que direccionan las acciones del store. El índice dentro del
              // grupo no sirve: una superserie agrupa ejercicios salteados.
              exerciseIndex={grupo.indices[i]}
              catalog={catalogByName.get(normalizeName(ex.name))}
              libraryExercise={libraryByName.get(normalizeName(ex.name))}
              weightUnit={weightUnit}
              onAdvice={registerAdvice}
              onDuration={registerDuration}
            />
          ));

          // Un ejercicio suelto se pinta igual que siempre: sin marco, sin
          // etiqueta y sin un nivel de anidamiento de más.
          if (grupo.supersetId === null || grupo.exercises.length < 2) return tarjetas;

          return (
            <div
              key={grupo.supersetId}
              className="rounded-card border border-accent/30 bg-accent/5 p-2"
            >
              <div className="label-caps px-1 pb-2 text-accent">{t('routine.superset_label')}</div>
              {/* Encadenados y en el orden en que se hacen: el marco es lo que
                  dice «esto va seguido», que es la única diferencia real entre
                  una superserie y dos ejercicios uno detrás de otro. */}
              <div className="space-y-2">{tarjetas}</div>
            </div>
          );
        })}
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
