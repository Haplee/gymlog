import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trash2, GripVertical } from 'lucide-react';
import { useRemoveExerciseFromWorkout } from '../hooks/useWorkoutExercises';
import { DeleteExerciseModal } from './DeleteExerciseModal';
import { ExerciseNotesEditor } from './ExerciseNotesEditor';
import type { WorkoutExercise } from '../types';

interface WorkoutExerciseCardProps {
  workoutId: string;
  workoutExercise: WorkoutExercise & { exercise: { name: string; muscle_group: string } };
  userId: string;
  onRemoveSuccess?: () => void;
}

export function WorkoutExerciseCard({
  workoutId,
  workoutExercise,
  userId,
  onRemoveSuccess,
}: WorkoutExerciseCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const removeExerciseMutation = useRemoveExerciseFromWorkout(workoutId);

  const isOwner = workoutExercise.user_id === userId;

  const handleDelete = useCallback(async () => {
    if (!isOwner) return;

    setIsDeleting(true);
    try {
      await removeExerciseMutation.mutateAsync(workoutExercise.id);
      setShowDeleteModal(false);
      onRemoveSuccess?.();
    } catch (err) {
      console.error('Error removing exercise:', err);
    } finally {
      setIsDeleting(false);
    }
  }, [isOwner, workoutExercise.id, removeExerciseMutation, onRemoveSuccess]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && isOwner && !isDeleting) {
        e.preventDefault();
        setShowDeleteModal(true);
      }
    },
    [isOwner, isDeleting],
  );

  const exerciseName = workoutExercise.exercise?.name ?? 'Ejercicio';
  const muscleGroup = workoutExercise.exercise?.muscle_group ?? '';

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.2 }}
        className="relative group flex items-center gap-2 p-3 rounded-[var(--radius-md)]"
        style={{
          backgroundColor: 'var(--bg-surface-2)',
          border: '1px solid var(--border-glass)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
        }}
        onKeyDown={handleKeyDown}
        role="listitem"
        aria-label={`Ejercicio ${exerciseName}`}
      >
        <button
          className="cursor-grab active:cursor-grabbing transition-opacity opacity-30 group-active:opacity-70"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label="Reordenar ejercicio"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold truncate text-[0.9375rem]"
              style={{ color: 'var(--text-primary)' }}
            >
              {exerciseName}
            </span>
            {muscleGroup && (
              <span
                className="text-[0.5625rem] px-1.5 py-0.5 rounded-[var(--radius-pill)] font-semibold uppercase tracking-wide shrink-0"
                style={{
                  backgroundColor: 'rgba(200,255,0,0.08)',
                  color: 'var(--interactive-primary)',
                  border: '1px solid rgba(200,255,0,0.15)',
                }}
              >
                {muscleGroup}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ExerciseNotesEditor
            workoutId={workoutId}
            workoutExerciseId={workoutExercise.id}
            initialNotes={workoutExercise.notes}
            exerciseName={exerciseName}
          />

          {isOwner && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-1.5 rounded-[var(--radius-sm)] transition-colors"
              style={{ color: 'var(--error)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,69,58,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              aria-label={`Eliminar ${exerciseName} del entrenamiento`}
              title="Eliminar ejercicio"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {!isOwner && <div className="absolute inset-0 bg-transparent pointer-events-none" />}
      </motion.div>

      <DeleteExerciseModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        exerciseName={exerciseName}
        isDeleting={isDeleting}
      />
    </>
  );
}
