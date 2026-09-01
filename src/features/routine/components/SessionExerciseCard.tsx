import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useExerciseAdvice } from '@features/stats/hooks/useExerciseAdvice';
import type { ExerciseAdvice } from '@features/stats/hooks/useAutoregulation';
import { useExerciseRepRange } from '@shared/hooks/useExerciseRepRange';
import { EquipmentIcon } from '@shared/components/icons/EquipmentIcons';
import { isBodyweightLoad } from '@shared/lib/loadType';
import { weightToInput } from '@shared/lib/weight';
import type { Exercise } from '@shared/lib/types';
import type { LibraryExercise } from '@shared/api/queries';
import { useRoutineSessionStore, type SessionExercise } from '../stores/routineSessionStore';
import { WorkTimer } from '@features/workout/components/WorkTimer';
import { formatSegundos } from '@features/routine/utils/planTarget';
import { perSideCount, totalFromPerSide } from '@shared/lib/perSide';
import { muscleGroupLabel } from '@shared/lib/muscleGroupLabel';
import { equipmentLabel } from '@shared/lib/equipmentLabel';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Minus,
  Plus,
  TrendDown,
  TrendUp,
  X,
} from '@shared/components/icons';

const ACTION_ICON = {
  increase: TrendUp,
  reduce: TrendDown,
  hold: Minus,
} as const;

/** Valores de RPE que se ofrecen, los mismos que en la pantalla de entreno. */
const RPE_OPTIONS = ['6', '7', '8', '9', '10'] as const;

interface Props {
  userId: string;
  exercise: SessionExercise;
  /** Posición del ejercicio en la sesión: es lo que direccionan las acciones del store. */
  exerciseIndex: number;
  /** Ejercicio resuelto en el catálogo (propio/público) por nombre. */
  catalog?: Exercise;
  /** Ficha de la biblioteca (descripción de la forma) por nombre. */
  libraryExercise?: LibraryExercise;
  weightUnit: 'kg' | 'lb';
  /**
   * La sesión de rutina autocompleta el registro con el peso recomendado. La
   * tarjeta le reporta la recomendación de cada ejercicio (si la hay) para que
   * el botón «Completar» pueda rellenarla sin que el usuario teclee nada.
   */
  onAdvice: (exerciseName: string, advice: ExerciseAdvice | null) => void;
  /**
   * Segundos aguantados en una serie por tiempo, según el cronómetro. Solo se
   * pasa para los ejercicios en modo tiempo.
   */
  onDuration?: (exerciseName: string, seconds: number) => void;
}

/**
 * Tarjeta de un ejercicio dentro de la sesión de rutina.
 *
 * **Registra lo que ha pasado, no lo que estaba planeado.** Antes esta tarjeta
 * era solo informativa: enseñaba el peso recomendado y, al pulsar «Completar»,
 * la sesión escribía ese peso en todas las series con las repeticiones del plan.
 * Es decir, guardaba la propuesta de la app como si fuera el entrenamiento. El
 * motor se alimentaba después de esos datos, así que se leía a sí mismo: todas
 * las series salían siempre en el techo del rango, el e1RM subía solo y el
 * estancamiento no se detectaba nunca.
 *
 * Ahora las filas vienen precargadas —repeticiones del plan y peso recomendado,
 * que sigue siendo «no teclear nada» en el caso normal— pero se pueden corregir,
 * y hay RPE por ejercicio: es lo que enciende la autorregulación y la descarga.
 */
export function SessionExerciseCard({
  userId,
  exercise,
  exerciseIndex,
  catalog,
  libraryExercise,
  weightUnit,
  onAdvice,
  onDuration,
}: Props) {
  const { t, i18n } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const esPorTiempo = exercise.mode === 'time';
  const { updateSet, addSet, removeSet, setExerciseRpe } = useRoutineSessionStore(
    useShallow((s) => ({
      updateSet: s.updateSet,
      addSet: s.addSet,
      removeSet: s.removeSet,
      setExerciseRpe: s.setExerciseRpe,
    })),
  );
  // El RPE es del ejercicio, no de cada serie: en una sesión de rutina nadie va
  // a marcar cinco veces lo mismo, y lo que consume el motor es la media de la
  // sesión. Se lee de la primera serie porque se escribe en todas a la vez.
  const rpeActual = exercise.sets[0]?.rpe ?? '';

  /**
   * El objetivo de repeticiones, en total y con la lectura por lado detrás:
   * «24 (12 por lado)».
   *
   * El número grande es el total porque es lo que se registra; el paréntesis es
   * lo que se cuenta en la serie. Enseñar solo uno de los dos obliga a hacer la
   * cuenta mental justo en el momento de menos cabeza libre.
   */
  const objetivoReps = (() => {
    if (esPorTiempo) return null;
    const base = Number(exercise.targetReps?.trim().match(/^\d+/)?.[0]);
    if (!Number.isFinite(base)) return exercise.targetReps ?? null;
    const total = totalFromPerSide(base, exercise.perSide);
    const porLado = perSideCount(total, exercise.perSide);
    if (porLado == null) return exercise.targetReps ?? String(total);
    const num = porLado.toLocaleString(i18n.language, { maximumFractionDigits: 1 });
    return `${total} (${num} ${t('routine.target_per_side')})`;
  })();

  // El objetivo de la sesión manda sobre la búsqueda por nombre: aquí ya se
  // sabe de qué día viene el ejercicio.
  const { repMin, repMax } = useExerciseRepRange(exercise.name, exercise.targetReps);
  const equipment = catalog?.equipment ?? libraryExercise?.equipment ?? null;
  const muscleGroup = catalog?.muscle_group ?? libraryExercise?.muscle_group ?? null;
  const advice = useExerciseAdvice(userId, catalog?.id, {
    repMin,
    repMax,
    bodyweight: isBodyweightLoad(catalog?.load_type),
    // Manda el plan, no `exercises.is_bilateral`: el mismo remo se puede
    // programar a una o a dos manos, y lo que decide el objetivo es cómo lo
    // planificó quien entrena.
    perSide: exercise.perSide === true,
    muscleGroup: muscleGroup ?? undefined,
    equipment,
  });
  const description = libraryExercise?.description ?? null;
  const AdviceIcon = advice ? ACTION_ICON[advice.suggestion.action] : null;

  useEffect(() => {
    // Un ejercicio por tiempo nunca reporta consejo: si lo hiciera, el peso
    // recomendado se escribiría en las series de una plancha.
    if (esPorTiempo) return;
    onAdvice(exercise.name, advice);
    return () => onAdvice(exercise.name, null);
  }, [advice, exercise.name, onAdvice, esPorTiempo]);

  return (
    <div className="rounded-card p-3 bg-surface-2 border border-line">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-display font-bold text-fg truncate">{exercise.name}</div>
          {(muscleGroup || equipment) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {muscleGroup && (
                <span className="label-caps px-2 py-1 rounded-pill bg-surface-3 text-fg-muted">
                  {muscleGroupLabel(muscleGroup, t)}
                </span>
              )}
              {equipment && (
                <span className="label-caps px-2 py-1 rounded-pill bg-surface-3 text-fg-muted inline-flex items-center gap-1">
                  <EquipmentIcon equipment={equipment} className="w-3.5 h-3.5" />
                  {equipmentLabel(equipment, t)}
                </span>
              )}
            </div>
          )}
        </div>
        {exercise.targetSets && (
          <span className="flex-shrink-0 font-display text-lg font-bold px-2.5 py-1 rounded-pill bg-accent/10 text-accent tabular">
            {exercise.targetSets}
            <span className="mx-1 text-fg-subtle">×</span>
            {/* En modo tiempo el objetivo son segundos. Pintar `targetReps`
                aquí diría «45 repeticiones de plancha». */}
            {esPorTiempo
              ? exercise.targetDurationSeconds != null
                ? formatSegundos(exercise.targetDurationSeconds)
                : t('workout.mode_time')
              : objetivoReps}
          </span>
        )}
      </div>

      {esPorTiempo ? (
        // Un ejercicio por tiempo no recibe consejo de carga: el motor solo mira
        // series de repeticiones. Lo que necesita aquí es el cronómetro.
        <div className="mt-3">
          <WorkTimer
            targetSeconds={exercise.targetDurationSeconds ?? null}
            onAccept={(seconds) => onDuration?.(exercise.name, seconds)}
          />
        </div>
      ) : advice ? (
        <div className="mt-3 rounded-card border border-accent/25 bg-accent/5 p-3">
          <div className="label-caps text-accent">{t('routine.session_recommended_weight')}</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-xl font-display font-bold text-fg tabular">
              {weightToInput(advice.suggestion.weight, weightUnit)} {weightUnit}
            </span>
            {AdviceIcon && (
              <AdviceIcon className="w-3.5 h-3.5 self-center text-accent" aria-hidden="true" />
            )}
            <span className="label-caps text-fg-subtle">
              {t(`coach.action.${advice.suggestion.action}`)}
            </span>
          </div>
          {/* De dónde se viene, igual que en la tarjeta de la pantalla de
              entreno: la misma sugerencia se contaba de dos maneras distintas
              según por dónde se entrase. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="label-caps rounded-sm bg-surface-3 px-2 py-1 text-fg-muted">
              {t('coach.last_label')} · {weightToInput(advice.suggestion.baseWeight, weightUnit)}{' '}
              {weightUnit} × {advice.suggestion.baseReps}
            </span>
            <span className="label-caps text-fg-subtle">
              {t(`coach.confidence_${advice.suggestion.confidence}`)}
            </span>
          </div>
          <p className="mt-2 text-xs text-fg-muted">{t(advice.suggestion.reasonKey)}</p>
          {advice.stall?.stalled && (
            <p className="mt-2 flex gap-1.5 text-xs text-fg-muted">
              <AlertTriangle
                className="w-3.5 h-3.5 flex-shrink-0 text-warning"
                aria-hidden="true"
              />
              <span>{t(`coach.stall.cause_${advice.stall.causeKey}`)}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 glass-2 rounded-card-3 p-3 text-xs text-fg-muted">
          {t('routine.session_no_recommendation')}
        </p>
      )}

      {/* Lo que se ha hecho de verdad. Viene precargado con el objetivo del plan
          y el peso recomendado, así que en el caso normal no hay que escribir
          nada; corregir una fila es lo que hace que el historial deje de ser una
          copia de la recomendación. */}
      {!esPorTiempo && (
        <div className="mt-3">
          <div className="label-caps mb-1.5 text-fg-subtle">{t('routine.session_log')}</div>
          <ul className="space-y-1.5">
            {exercise.sets.map((serie, i) => (
              <li key={serie.id} className="flex items-center gap-2">
                <span className="label-caps w-6 flex-shrink-0 text-fg-subtle tabular">{i + 1}</span>
                <label className="min-w-0 flex-1">
                  <span className="sr-only">{t('routine.session_reps_of_set', { n: i + 1 })}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={t('workout.reps')}
                    value={serie.reps}
                    onChange={(e) =>
                      updateSet(exerciseIndex, i, {
                        reps: e.target.value.replace(/[^\d]/g, ''),
                      })
                    }
                    className="w-full min-h-11 rounded-sm border border-line bg-surface px-2 text-center text-base text-fg tabular outline-none focus:border-accent"
                  />
                </label>
                <span className="text-fg-subtle" aria-hidden="true">
                  ×
                </span>
                <label className="min-w-0 flex-1">
                  <span className="sr-only">
                    {t('routine.session_weight_of_set', { n: i + 1 })}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={weightUnit}
                    value={serie.weight}
                    onChange={(e) =>
                      updateSet(exerciseIndex, i, {
                        weight: e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'),
                        // A partir de aquí la fila es del usuario: la
                        // recomendación ya no la vuelve a pisar.
                        weightTouched: true,
                      })
                    }
                    className="w-full min-h-11 rounded-sm border border-line bg-surface px-2 text-center text-base text-fg tabular outline-none focus:border-accent"
                  />
                </label>
                {exercise.sets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSet(exerciseIndex, i)}
                    aria-label={t('routine.session_remove_set', { n: i + 1 })}
                    className="flex h-11 w-9 flex-shrink-0 items-center justify-center rounded-sm text-fg-subtle active:opacity-60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => addSet(exerciseIndex)}
            className="label-caps mt-2 flex min-h-11 items-center gap-1.5 text-fg-muted active:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t('routine.session_add_set')}
          </button>

          {/* RPE del ejercicio. Es la señal que enciende la autorregulación: sin
              ella el motor cae al respaldo de doble progresión y la descarga no
              se propone nunca, suba lo que suba el volumen. */}
          <div className="mt-3">
            <div className="label-caps mb-1.5 text-fg-subtle">
              {t('workout.rpe_label')}
              <span className="ml-1.5 normal-case tracking-normal">
                {t('workout.rpe_optional')}
              </span>
            </div>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={t('workout.rpe_label')}
            >
              {RPE_OPTIONS.map((value) => {
                const on = rpeActual === value;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setExerciseRpe(exerciseIndex, on ? '' : value)}
                    aria-pressed={on}
                    aria-label={t('workout.rpe_option', { value })}
                    className={`min-h-11 min-w-11 rounded-sm border px-2 text-sm font-medium transition-colors ${
                      on
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-line bg-surface text-fg-muted'
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {description && (
        <div className="mt-3 border-t border-line pt-1">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            aria-expanded={showForm}
            className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
          >
            <span className="label-caps inline-flex items-center gap-1.5 text-fg-muted">
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              {t('routine.session_how_to')}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-fg-subtle transition-transform ${showForm ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          {showForm && <p className="pb-2 text-sm leading-relaxed text-fg-muted">{description}</p>}
        </div>
      )}
    </div>
  );
}
