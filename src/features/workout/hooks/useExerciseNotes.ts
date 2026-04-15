import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { saveExerciseNote, deleteExerciseNote, fetchExerciseNotes } from '@shared/api/queries';
import type { ExerciseNote } from '@shared/lib/types';

const EXERCISE_NOTES_KEY = ['exerciseNotes'];

export function useExerciseNotes(userId: string | undefined, exerciseId: string | undefined) {
  return useQuery({
    queryKey: [...EXERCISE_NOTES_KEY, userId, exerciseId],
    queryFn: () => {
      if (!userId || !exerciseId) throw new Error('Missing userId or exerciseId');
      return fetchExerciseNotes(userId, exerciseId);
    },
    enabled: !!userId && !!exerciseId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateExerciseNote(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ exerciseId, note }: { exerciseId: string; note: string }) =>
      saveExerciseNote(userId, exerciseId, note),
    onMutate: async ({ exerciseId, note }) => {
      await queryClient.cancelQueries({
        queryKey: [...EXERCISE_NOTES_KEY, userId, exerciseId],
      });

      const previousNotes = queryClient.getQueryData<ExerciseNote[]>([
        ...EXERCISE_NOTES_KEY,
        userId,
        exerciseId,
      ]);

      const optimisticNote: ExerciseNote = {
        id: `temp-${Date.now()}`,
        user_id: userId,
        exercise_id: exerciseId,
        note,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<ExerciseNote[]>(
        [...EXERCISE_NOTES_KEY, userId, exerciseId],
        (old) => [optimisticNote, ...(old || [])],
      );

      return { previousNotes };
    },
    onError: (_err, vars, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData<ExerciseNote[]>(
          [...EXERCISE_NOTES_KEY, userId, vars.exerciseId],
          context.previousNotes,
        );
      }
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: [...EXERCISE_NOTES_KEY, userId, vars.exerciseId],
      });
    },
  });
}

export function useDeleteExerciseNote(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => deleteExerciseNote(noteId),
    onMutate: async (noteId) => {
      await queryClient.cancelQueries({
        queryKey: ['exerciseNotes', userId],
      });

      const previousNotes = queryClient.getQueryData<ExerciseNote[]>(['exerciseNotes', userId]);

      queryClient.setQueryData<ExerciseNote[]>(
        ['exerciseNotes', userId],
        (old) => old?.filter((n) => n.id !== noteId) || [],
      );

      return { previousNotes };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(['exerciseNotes', userId], context.previousNotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['exerciseNotes', userId],
      });
    },
  });
}
