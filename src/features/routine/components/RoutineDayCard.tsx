import { useTranslation } from 'react-i18next';
import type { Routine, DayOfWeek, RoutineExercise } from '@features/routine/stores/routineStore';
import { EmptyState } from '@shared/components/EmptyStates';
import { SortableExerciseList } from '@features/routine/components/SortableExerciseList';

interface RoutineDayCardProps {
  /** Rutina activa: se garantiza no nula porque el selector ya se ha descartado. */
  routine: Routine;
  /** Día del calendario que se está viendo. */
  selectedDay: DayOfWeek;
  /** Día de la rutina cuyo contenido se muestra aquí, o null si el día quedó libre. */
  sourceDay: DayOfWeek | null;
  /** Día del que viene el contenido, solo si la semana está reorganizada. */
  movedFrom: DayOfWeek | null;
  dayExercises: RoutineExercise[];
  onOpenMovePicker: () => void;
  onOpenExercisePicker: () => void;
  onRestoreWeek: () => void;
  onReorder: (next: RoutineExercise[]) => void;
  onRemove: (index: number) => void;
  onEdit: (index: number) => void;
}

/** Tarjeta del día en curso: cabecera, acciones y la lista de ejercicios. */
export function RoutineDayCard({
  routine,
  selectedDay,
  sourceDay,
  movedFrom,
  dayExercises,
  onOpenMovePicker,
  onOpenExercisePicker,
  onRestoreWeek,
  onReorder,
  onRemove,
  onEdit,
}: RoutineDayCardProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-card p-3 bg-surface border border-line">
      <div className="hairline-separator flex justify-between items-center gap-2 pb-2 mb-3">
        <div className="min-w-0">
          <div className="label-caps text-fg-subtle">{t(`routine.days.${selectedDay}`)}</div>
          {movedFrom && (
            <div className="text-xs mt-0.5 text-accent">
              {t('routine.moved_from', { day: t(`routine.days.${movedFrom}`) })}
            </div>
          )}
        </div>
        {dayExercises.length > 0 && (
          <button
            type="button"
            onClick={onOpenMovePicker}
            className="flex-shrink-0 min-h-11 text-xs px-2.5 py-1.5 rounded-pill bg-surface-2 text-fg-muted"
          >
            {t('routine.move_day')}
          </button>
        )}
        {/* Con el día vacío la acción ya la ofrece el estado vacío, en
            grande y en el centro: repetirla aquí solo añade ruido. */}
        {dayExercises.length > 0 && (
          <button
            type="button"
            onClick={onOpenExercisePicker}
            className="min-h-11 text-xs px-2.5 py-1.5 rounded-pill bg-surface-2 text-fg-muted"
          >
            {t('routine.add_exercise')}
          </button>
        )}
      </div>

      {sourceDay === null ? (
        <EmptyState
          type="routine"
          title={t('routine.day_freed')}
          description={t('routine.day_freed_desc')}
          action={{ label: t('routine.week_restore'), onClick: onRestoreWeek }}
        />
      ) : dayExercises.length === 0 ? (
        // Antes era una línea de texto de 12 px en medio de una pantalla
        // medio vacía, y en las rutinas propias remataba mandando al
        // usuario a «el selector de arriba»: describía la acción en vez de
        // ofrecerla. Ahora el vacío se explica y trae su botón.
        routine.isCustom ? (
          <EmptyState
            type="workout"
            title={t('routine.empty_custom_day')}
            description={t('routine.empty_custom_day_desc')}
            action={{
              label: t('routine.add_exercise_full'),
              onClick: onOpenExercisePicker,
            }}
          />
        ) : (
          <EmptyState
            type="routine"
            title={t('routine.rest_day')}
            description={t('routine.rest_day_desc')}
          />
        )
      ) : (
        <SortableExerciseList
          exercises={dayExercises}
          onReorder={onReorder}
          onRemove={onRemove}
          onEdit={onEdit}
        />
      )}
    </div>
  );
}
