import { useTranslation } from 'react-i18next';
import { Edit, X } from '@shared/components/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { RoutineExercise } from '@features/routine/stores/routineStore';
import { formatSegundos, planDurationOf, planModeOf } from '@features/routine/utils/planTarget';
import { Menu } from '@shared/components/icons';

interface SortableExerciseListProps {
  exercises: RoutineExercise[];
  onReorder: (next: RoutineExercise[]) => void;
  onRemove: (index: number) => void;
  /** Sin esto no se pinta el lápiz: en una plantilla no hay nada que editar. */
  onEdit?: (index: number) => void;
}

/**
 * El objetivo del ejercicio, en una línea.
 *
 * Una serie por tiempo se lee «3 × 45 s»: pintar «3 series × 45» reutilizando el
 * campo de reps diría que hay que hacer 45 repeticiones de plancha.
 */
function subtitulo(ex: RoutineExercise, porLado: string): string {
  const sufijo = ex.perSide ? ` ${porLado}` : '';

  if (planModeOf(ex) === 'time') {
    const segundos = planDurationOf(ex);
    const cuanto = segundos != null ? formatSegundos(segundos) : '—';
    return `${ex.sets ?? '?'} × ${cuanto}${sufijo}`;
  }

  if (ex.sets == null && !ex.reps) return sufijo.trim();
  return `${ex.sets ?? '?'} series × ${ex.reps ?? '?'}${sufijo}`;
}

function SortableRow({
  exercise,
  onRemove,
  onEdit,
}: {
  exercise: RoutineExercise;
  onRemove: () => void;
  onEdit?: () => void;
}) {
  const { t } = useTranslation();
  // El nombre es único por día (el selector de añadir filtra los ya presentes).
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.name,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center justify-between px-3 py-3 rounded-md bg-surface-2 border border-line ${
        isDragging ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t('library.reorder', { name: exercise.name })}
          className="h-11 w-11 -ml-1 flex items-center justify-center rounded-card text-fg-subtle touch-none cursor-grab active:cursor-grabbing"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <div className="text-base font-medium text-fg truncate">{exercise.name}</div>
          {subtitulo(exercise, t('routine.target_per_side')) && (
            <div className="text-xs mt-0.5 text-fg-subtle">
              {subtitulo(exercise, t('routine.target_per_side'))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center shrink-0">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('routine.edit_exercise', { name: exercise.name })}
            className="h-11 w-11 flex items-center justify-center rounded-card text-fg-subtle"
          >
            <Edit className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('library.remove_exercise', { name: exercise.name })}
          className="h-11 w-11 flex items-center justify-center rounded-card text-fg-subtle"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function SortableExerciseList({
  exercises,
  onReorder,
  onRemove,
  onEdit,
}: SortableExerciseListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = exercises.findIndex((e) => e.name === active.id);
    const newIndex = exercises.findIndex((e) => e.name === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(exercises, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={exercises.map((e) => e.name)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {exercises.map((ex, i) => (
            <SortableRow
              key={ex.name}
              exercise={ex}
              onRemove={() => onRemove(i)}
              onEdit={onEdit ? () => onEdit(i) : undefined}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
