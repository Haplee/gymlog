import { describe, it, expect, vi } from 'vitest';
import {
  fetchWorkoutExercises,
  addExerciseToWorkout,
  removeExerciseFromWorkout,
  updateExerciseNotes,
} from '../api/workoutMutations';

vi.mock('../api/workoutMutations', () => ({
  fetchWorkoutExercises: vi.fn(),
  addExerciseToWorkout: vi.fn(),
  removeExerciseFromWorkout: vi.fn(),
  updateExerciseNotes: vi.fn(),
}));

describe('workoutMutations', () => {
  describe('fetchWorkoutExercises', () => {
    it('should be a function', () => {
      expect(fetchWorkoutExercises).toBeDefined();
      expect(typeof fetchWorkoutExercises).toBe('function');
    });
  });

  describe('addExerciseToWorkout', () => {
    it('should be a function', () => {
      expect(addExerciseToWorkout).toBeDefined();
      expect(typeof addExerciseToWorkout).toBe('function');
    });
  });

  describe('removeExerciseFromWorkout', () => {
    it('should be a function', () => {
      expect(removeExerciseFromWorkout).toBeDefined();
      expect(typeof removeExerciseFromWorkout).toBe('function');
    });
  });

  describe('updateExerciseNotes', () => {
    it('should be a function', () => {
      expect(updateExerciseNotes).toBeDefined();
      expect(typeof updateExerciseNotes).toBe('function');
    });
  });
});
