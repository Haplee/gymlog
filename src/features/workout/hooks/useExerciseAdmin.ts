import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { deleteExercise, deleteExerciseNote, saveExerciseNote } from '@shared/api/queries';
import { devError } from '@shared/lib/devtools';
import type { ExerciseNote } from '@shared/lib/types';

interface ExerciseAdminArgs {
  userId: string | undefined;
  activeExerciseId: string | null;
  setActiveExercise: (id: string | null) => void;
}

/**
 * Notas del ejercicio activo y borrado de un ejercicio de la biblioteca.
 *
 * Las tres operaciones escriben en el cache de TanStack Query a mano (optimista
 * al guardar la nota, revalidación al borrar), así que viven juntas.
 */
export function useExerciseAdmin({
  userId,
  activeExerciseId,
  setActiveExercise,
}: ExerciseAdminArgs) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const handleSaveNote = useCallback(
    async (text: string) => {
      if (!userId || !activeExerciseId || !text) return;
      const tempId = `temp-${Date.now()}`;
      queryClient.setQueryData(
        ['exerciseNotes', userId, activeExerciseId],
        (old: ExerciseNote[] = []) => [
          {
            id: tempId,
            note: text,
            exercise_id: activeExerciseId,
            user_id: userId,
            created_at: new Date().toISOString(),
          } as ExerciseNote,
          ...old,
        ],
      );
      try {
        const saved = await saveExerciseNote(userId, activeExerciseId, text);
        queryClient.setQueryData(
          ['exerciseNotes', userId, activeExerciseId],
          (old: ExerciseNote[] = []) => [saved, ...old.filter((n) => n.id !== tempId)],
        );
      } catch {
        queryClient.setQueryData(
          ['exerciseNotes', userId, activeExerciseId],
          (old: ExerciseNote[] = []) => old.filter((n) => n.id !== tempId),
        );
        toast.error(t('workout.note_save_error'));
      }
    },
    [userId, activeExerciseId, queryClient, t],
  );

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      if (!userId || !activeExerciseId) return;
      queryClient.setQueryData(
        ['exerciseNotes', userId, activeExerciseId],
        (old: ExerciseNote[] = []) => old.filter((n) => n.id !== noteId),
      );
      await deleteExerciseNote(noteId).catch(() => {
        queryClient.invalidateQueries({ queryKey: ['exerciseNotes', userId, activeExerciseId] });
      });
    },
    [userId, activeExerciseId, queryClient],
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
        // Antes el error solo iba a la consola de desarrollo, así que en la app
        // el usuario tocaba la papelera y no pasaba absolutamente nada.
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

  return { handleSaveNote, handleDeleteNote, handleDeleteExercise };
}
