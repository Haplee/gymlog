import { describe, it, expect } from 'vitest';
import { groupSetsByExercise, repsRange } from '../historyHelpers';
import type { WorkoutSetWithDetails } from '@shared/lib/types';

describe('repsRange', () => {
  it('devuelve string vacío si array vacío', () => {
    expect(repsRange([])).toBe('');
  });

  it('devuelve un solo número si todos iguales', () => {
    expect(repsRange([10, 10, 10])).toBe('10');
  });

  it('devuelve rango min-max si hay variación', () => {
    expect(repsRange([8, 10, 12])).toBe('8-12');
    expect(repsRange([5, 5, 8])).toBe('5-8');
  });
});

/** Serie mínima: solo lo que mira el agrupador. */
function serie(name: string, reps: number, weight: number): WorkoutSetWithDetails {
  return {
    exercise: { name },
    reps,
    weight,
  } as unknown as WorkoutSetWithDetails;
}

describe('groupSetsByExercise', () => {
  it('devuelve una entrada por ejercicio, no una por serie', () => {
    const out = groupSetsByExercise([
      serie('Hip thrust', 8, 115),
      serie('Hip thrust', 9, 115),
      serie('Hip thrust', 10, 115),
    ]);
    expect(out).toEqual([{ name: 'Hip thrust', setCount: 3, reps: '8-10', weight: '115' }]);
  });

  it('conserva el orden de aparición y separa ejercicios distintos', () => {
    const out = groupSetsByExercise([
      serie('Prensa', 8, 165),
      serie('Extensiones', 10, 67.5),
      serie('Prensa', 8, 165),
    ]);
    expect(out.map((e) => e.name)).toEqual(['Prensa', 'Extensiones']);
    expect(out[0].setCount).toBe(2);
  });

  it('da rango también en el peso cuando la carga sube entre series', () => {
    const out = groupSetsByExercise([
      serie('Sentadilla', 5, 100),
      serie('Sentadilla', 5, 110),
      serie('Sentadilla', 3, 120),
    ]);
    expect(out[0]).toEqual({ name: 'Sentadilla', setCount: 3, reps: '3-5', weight: '100-120' });
  });

  it('ignora series sin nombre de ejercicio en vez de inventar una fila', () => {
    const huerfana = { reps: 8, weight: 50 } as unknown as WorkoutSetWithDetails;
    expect(groupSetsByExercise([huerfana])).toEqual([]);
  });

  it('sin series devuelve lista vacía', () => {
    expect(groupSetsByExercise([])).toEqual([]);
  });
});
