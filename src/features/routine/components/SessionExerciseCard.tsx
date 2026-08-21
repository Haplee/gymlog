import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExerciseAdvice } from '@features/stats/hooks/useExerciseAdvice';
import type { ExerciseAdvice } from '@features/stats/hooks/useAutoregulation';
import { useExerciseRepRange } from '@shared/hooks/useExerciseRepRange';
import { EquipmentIcon } from '@shared/components/icons/EquipmentIcons';
import { isBodyweightLoad } from '@shared/lib/loadType';
import { weightToInput } from '@shared/lib/weight';
import type { Exercise } from '@shared/lib/types';
import type { LibraryExercise } from '@shared/api/queries';
import type { SessionExercise } from '../stores/routineSessionStore';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Minus,
  TrendDown,
  TrendUp,
} from '@shared/components/icons';

const ACTION_ICON = {
  increase: TrendUp,
  reduce: TrendDown,
  hold: Minus,
} as const;

interface Props {
  userId: string;
  exercise: SessionExercise;
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
}

/**
 * Tarjeta informativa de un ejercicio dentro de la sesión de rutina.
 *
 * La rutina se registra sola: el usuario no escribe series ni pesos, solo ve lo
 * que necesita para ejecutar el ejercicio — material (con icono real),
 * forma/ejecución plegable y el peso que recomienda el motor de autorregulación.
 * Los ejercicios sin recomendación (sin historial) se muestran igual pero quedan
 * fuera del registro automático.
 */
export function SessionExerciseCard({
  userId,
  exercise,
  catalog,
  libraryExercise,
  weightUnit,
  onAdvice,
}: Props) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);

  // El objetivo de la sesión manda sobre la búsqueda por nombre: aquí ya se
  // sabe de qué día viene el ejercicio.
  const { repMin, repMax } = useExerciseRepRange(exercise.name, exercise.targetReps);
  const equipment = catalog?.equipment ?? libraryExercise?.equipment ?? null;
  const muscleGroup = catalog?.muscle_group ?? libraryExercise?.muscle_group ?? null;
  const advice = useExerciseAdvice(userId, catalog?.id, {
    repMin,
    repMax,
    bodyweight: isBodyweightLoad(catalog?.load_type),
    muscleGroup: muscleGroup ?? undefined,
  });
  const description = libraryExercise?.description ?? null;
  const AdviceIcon = advice ? ACTION_ICON[advice.suggestion.action] : null;

  useEffect(() => {
    onAdvice(exercise.name, advice);
    return () => onAdvice(exercise.name, null);
  }, [advice, exercise.name, onAdvice]);

  return (
    <div className="rounded-card p-3 bg-surface-2 border border-line">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-display font-bold text-fg truncate">{exercise.name}</div>
          {(muscleGroup || equipment) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {muscleGroup && (
                <span className="label-caps px-2 py-1 rounded-pill bg-surface-3 text-fg-muted">
                  {muscleGroup}
                </span>
              )}
              {equipment && (
                <span className="label-caps px-2 py-1 rounded-pill bg-surface-3 text-fg-muted inline-flex items-center gap-1">
                  <EquipmentIcon equipment={equipment} className="w-3.5 h-3.5" />
                  {equipment}
                </span>
              )}
            </div>
          )}
        </div>
        {exercise.targetSets && (
          <span className="flex-shrink-0 font-display text-lg font-bold px-2.5 py-1 rounded-pill bg-accent/10 text-accent tabular">
            {exercise.targetSets}
            <span className="mx-1 text-fg-subtle">×</span>
            {exercise.targetReps}
          </span>
        )}
      </div>

      {advice ? (
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
