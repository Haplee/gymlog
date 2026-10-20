import { describe, it, expect } from 'vitest';
import type { DayRoutine, RoutineExercise } from '@features/routine/stores/routineStore';
import {
  appendExerciseToDay,
  removeExerciseFromDay,
  reorderDayExercises,
  replaceExerciseInDay,
  type RoutineDays,
} from '../dayEdits';

/** Día con una lista de ejercicios, para no repetir el envoltorio en cada caso. */
function day(...exercises: RoutineExercise[]): DayRoutine {
  return { name: 'Lunes', exercises };
}

function days(monday: DayRoutine): RoutineDays {
  return {
    monday,
    tuesday: day(),
    wednesday: day(),
    thursday: day(),
    friday: day(),
    saturday: day(),
    sunday: day(),
  };
}

describe('appendExerciseToDay', () => {
  it('añade al final sin tocar lo que ya había', () => {
    const base = days(day({ name: 'Press banca' }));
    const next = appendExerciseToDay(base, 'monday', { name: 'Remo' });

    expect(next.monday.exercises.map((e) => e.name)).toEqual(['Press banca', 'Remo']);
    // El mapa original no se muta: el store compara referencias.
    expect(base.monday.exercises).toHaveLength(1);
    expect(next).not.toBe(base);
  });
});

describe('removeExerciseFromDay', () => {
  it('quita por índice y deja el resto en orden', () => {
    const base = days(day({ name: 'A' }, { name: 'B' }, { name: 'C' }));
    const next = removeExerciseFromDay(base, 'monday', 1);
    expect(next.monday.exercises.map((e) => e.name)).toEqual(['A', 'C']);
  });

  it('un índice fuera de rango no cambia nada', () => {
    const base = days(day({ name: 'A' }));
    const next = removeExerciseFromDay(base, 'monday', 9);
    expect(next.monday.exercises.map((e) => e.name)).toEqual(['A']);
  });
});

describe('reorderDayExercises', () => {
  it('sustituye la lista entera del día', () => {
    const base = days(day({ name: 'A' }, { name: 'B' }));
    const next = reorderDayExercises(base, 'monday', [{ name: 'B' }, { name: 'A' }]);
    expect(next.monday.exercises.map((e) => e.name)).toEqual(['B', 'A']);
  });
});

describe('replaceExerciseInDay', () => {
  it('sustituye solo la fila editada', () => {
    const base = days(day({ name: 'A', sets: 3 }, { name: 'B', sets: 3 }));
    const next = replaceExerciseInDay(base, 'monday', 1, { name: 'B', sets: 5 });
    expect(next.monday.exercises[0]).toEqual({ name: 'A', sets: 3 });
    expect(next.monday.exercises[1]).toEqual({ name: 'B', sets: 5 });
  });

  it('al encadenar escribe el mismo id en la fila de arriba', () => {
    // Un grupo lo forman dos filas consecutivas: el editor solo devuelve la de
    // abajo, así que el id tiene que propagarse hacia arriba o el grupo queda
    // a medias y `groupPlanExercises` no lo pinta.
    const base = days(day({ name: 'A' }, { name: 'B' }));
    const next = replaceExerciseInDay(base, 'monday', 1, { name: 'B', supersetId: 'ss-1' });

    expect(next.monday.exercises[0]?.supersetId).toBe('ss-1');
    expect(next.monday.exercises[1]?.supersetId).toBe('ss-1');
  });

  it('si la fila de arriba ya compartía el id no la toca', () => {
    const base = days(day({ name: 'A', supersetId: 'ss-1' }, { name: 'B', supersetId: 'ss-1' }));
    const next = replaceExerciseInDay(base, 'monday', 1, {
      name: 'B',
      supersetId: 'ss-1',
      sets: 4,
    });

    expect(next.monday.exercises[0]).toEqual(base.monday.exercises[0]);
    expect(next.monday.exercises[1]?.sets).toBe(4);
  });

  it('un grupo nuevo sobre la misma fila de arriba reescribe el id', () => {
    const base = days(day({ name: 'A', supersetId: 'viejo' }, { name: 'B', supersetId: 'viejo' }));
    const next = replaceExerciseInDay(base, 'monday', 1, { name: 'B', supersetId: 'nuevo' });
    expect(next.monday.exercises[0]?.supersetId).toBe('nuevo');
  });

  it('desencadenar deja la fila de arriba como estaba', () => {
    const base = days(day({ name: 'A', supersetId: 'ss-1' }, { name: 'B', supersetId: 'ss-1' }));
    const next = replaceExerciseInDay(base, 'monday', 1, { name: 'B' });
    expect(next.monday.exercises[0]?.supersetId).toBe('ss-1');
  });

  it('la primera fila no tiene fila de arriba a la que propagar', () => {
    const base = days(day({ name: 'A' }, { name: 'B' }));
    const next = replaceExerciseInDay(base, 'monday', 0, { name: 'A', supersetId: 'ss-1' });
    expect(next.monday.exercises[0]?.supersetId).toBe('ss-1');
    expect(next.monday.exercises[1]?.supersetId).toBeUndefined();
  });
});
