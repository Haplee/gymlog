import { describe, it, expect } from 'vitest';
import { findRoutineTargetReps, resolveExerciseRepRange } from '../exerciseTargets';
import type { Routine, DayOfWeek, DayRoutine } from '@features/routine/stores/routineStore';

const emptyDay: DayRoutine = { name: 'Descanso', exercises: [] };

function makeRoutine(days: Partial<Record<DayOfWeek, DayRoutine>>): Routine {
  return {
    id: 'r1',
    name: 'Rutina de prueba',
    description: '',
    isCustom: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    days: {
      monday: emptyDay,
      tuesday: emptyDay,
      wednesday: emptyDay,
      thursday: emptyDay,
      friday: emptyDay,
      saturday: emptyDay,
      sunday: emptyDay,
      ...days,
    },
  };
}

const routine = makeRoutine({
  monday: {
    name: 'Inferior',
    exercises: [
      { name: 'Sentadilla', sets: 4, reps: '5' },
      { name: 'Sentadilla búlgara', sets: 3, reps: '8 por pierna' },
      { name: 'Press Pallof', sets: 3, reps: '12 por lado' },
    ],
  },
  thursday: {
    name: 'Tirón',
    exercises: [
      { name: 'Remo con barra', sets: 4, reps: '6' },
      { name: 'Dominadas', sets: 5, reps: '8-10' },
    ],
  },
});

describe('findRoutineTargetReps', () => {
  it('encuentra el objetivo en cualquier día de la rutina', () => {
    expect(findRoutineTargetReps(routine, 'Sentadilla')).toBe('5');
    expect(findRoutineTargetReps(routine, 'Remo con barra')).toBe('6');
  });

  it('empareja ignorando mayúsculas y acentos', () => {
    expect(findRoutineTargetReps(routine, 'SENTADILLA BULGARA')).toBe('8 por pierna');
    expect(findRoutineTargetReps(routine, '  press pallof  ')).toBe('12 por lado');
  });

  it('devuelve undefined si el ejercicio no está en la rutina', () => {
    expect(findRoutineTargetReps(routine, 'Curl bíceps barra')).toBeUndefined();
  });

  it('tolera rutina o nombre ausentes', () => {
    expect(findRoutineTargetReps(null, 'Sentadilla')).toBeUndefined();
    expect(findRoutineTargetReps(routine, '')).toBeUndefined();
    expect(findRoutineTargetReps(routine, undefined)).toBeUndefined();
  });
});

describe('resolveExerciseRepRange', () => {
  it('objetivo de un solo número: suelo y techo iguales', () => {
    expect(resolveExerciseRepRange('Sentadilla', routine)).toEqual({ repMin: 5, repMax: 5 });
  });

  it('objetivo con rango: suelo y techo del rango', () => {
    expect(resolveExerciseRepRange('Dominadas', routine)).toEqual({ repMin: 8, repMax: 10 });
  });

  it('objetivo con texto adicional: se queda con el número', () => {
    expect(resolveExerciseRepRange('Press Pallof', routine)).toEqual({ repMin: 12, repMax: 12 });
  });

  it('el objetivo explícito manda sobre la búsqueda en la rutina', () => {
    // La rutina dice 5, pero la sesión sabe que este día son 3.
    expect(resolveExerciseRepRange('Sentadilla', routine, '3')).toEqual({
      repMin: 3,
      repMax: 3,
    });
  });

  it('sin objetivo devuelve rango vacío, no un rango por defecto', () => {
    expect(resolveExerciseRepRange('Curl bíceps barra', routine)).toEqual({});
    expect(resolveExerciseRepRange('Sentadilla', null)).toEqual({});
  });

  it('ambos consumidores resuelven lo mismo para el mismo ejercicio', () => {
    // La pantalla de entreno busca por nombre; la sesión de rutina pasa el
    // objetivo explícito que viene de esa misma rutina. Deben coincidir.
    const desdeInicio = resolveExerciseRepRange('Remo con barra', routine);
    const desdeRutina = resolveExerciseRepRange('Remo con barra', routine, '6');
    expect(desdeInicio).toEqual(desdeRutina);
  });
});
