import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchWorkoutExercises,
  addExerciseToWorkout,
  removeExerciseFromWorkout,
  updateExerciseNotes,
  WORKOUT_EXERCISES_KEYS,
} from '../api/workoutMutations';
import type { WorkoutExercise } from '../types';

export function useWorkoutExercises(workoutId: string | undefined) {
  return useQuery({
    queryKey: WORKOUT_EXERCISES_KEYS.byWorkout(workoutId ?? ''),
    queryFn: () => {
      if (!workoutId) throw new Error('Missing workoutId');
      return fetchWorkoutExercises(workoutId);
    },
    enabled: !!workoutId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useAddExerciseToWorkout(workoutId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ exerciseId, userId }: { exerciseId: string; userId: string }) =>
      addExerciseToWorkout(workoutId, exerciseId, userId),
    onMutate: async ({ exerciseId, userId }) => {
      await queryClient.cancelQueries({
        queryKey: WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
      });

      const previousExercises = queryClient.getQueryData<WorkoutExercise[]>(
        WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
      );

      const optimisticExercise: WorkoutExercise = {
        id: `temp-${Date.now()}`,
        workout_id: workoutId,
        exercise_id: exerciseId,
        user_id: userId,
        order_index: previousExercises?.length ?? 0,
        notes: undefined,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<WorkoutExercise[]>(
        WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
        (old) => [...(old || []), optimisticExercise],
      );

      return { previousExercises };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousExercises) {
        queryClient.setQueryData<WorkoutExercise[]>(
          WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
          context.previousExercises,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
      });
    },
  });
}

export function useRemoveExerciseFromWorkout(workoutId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workoutExerciseId: string) => removeExerciseFromWorkout(workoutExerciseId),
    onMutate: async (workoutExerciseId) => {
      await queryClient.cancelQueries({
        queryKey: WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
      });

      const previousExercises = queryClient.getQueryData<WorkoutExercise[]>(
        WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
      );

      queryClient.setQueryData<WorkoutExercise[]>(
        WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
        (old) => old?.filter((we) => we.id !== workoutExerciseId) || [],
      );

      return { previousExercises };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousExercises) {
        queryClient.setQueryData<WorkoutExercise[]>(
          WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
          context.previousExercises,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
      });
    },
  });
}

export function useUpdateExerciseNotes(workoutId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workoutExerciseId, notes }: { workoutExerciseId: string; notes: string }) =>
      updateExerciseNotes(workoutExerciseId, notes),
    onMutate: async ({ workoutExerciseId, notes }) => {
      await queryClient.cancelQueries({
        queryKey: WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
      });

      const previousExercises = queryClient.getQueryData<WorkoutExercise[]>(
        WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
      );

      queryClient.setQueryData<WorkoutExercise[]>(
        WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
        (old) => old?.map((we) => (we.id === workoutExerciseId ? { ...we, notes } : we)) || [],
      );

      return { previousExercises };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousExercises) {
        queryClient.setQueryData<WorkoutExercise[]>(
          WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
          context.previousExercises,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: WORKOUT_EXERCISES_KEYS.byWorkout(workoutId),
      });
    },
  });
}
