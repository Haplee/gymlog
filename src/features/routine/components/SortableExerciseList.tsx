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
import { GripVertical } from 'lucide-react';
import type { RoutineExercise } from '@features/routine/stores/routineStore';

interface SortableExerciseListProps {
  exercises: RoutineExercise[];
  onReorder: (next: RoutineExercise[]) => void;
  onRemove: (index: number) => void;
}

function SortableRow({ exercise, onRemove }: { exercise: RoutineExercise; onRemove: () => void }) {
  // El nombre es único por día (el selector de añadir filtra los ya presentes).
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.name,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center justify-between px-3 py-3 rounded-xl bg-surface-2 border border-line ${
        isDragging ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reordenar ${exercise.name}`}
          className="w-9 h-9 -ml-1 flex items-center justify-center rounded-lg text-fg-subtle touch-none cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <div className="text-base font-medium text-fg truncate">{exercise.name}</div>
          {exercise.sets && (
            <div className="text-xs mt-0.5 text-fg-subtle">
              {exercise.sets} series × {exercise.reps}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onRemove}
        aria-label={`Eliminar ${exercise.name}`}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-lg text-fg-subtle"
      >
        ×
      </button>
    </div>
  );
}

export function SortableExerciseList({
  exercises,
  onReorder,
  onRemove,
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
            <SortableRow key={ex.name} exercise={ex} onRemove={() => onRemove(i)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
