/**
 * Escalones reales de la sala: la escalera, no el salto único.
 *
 * El motor de progresión daba por hecho un escalón fijo —2,5 kg, o lo que dijera
 * un único número en Ajustes—. Eso ignora que un gimnasio no tiene *un* salto,
 * tiene una escalera: las mancuernas de la sala que motivó esto van de 0,5 y 2,5
 * hasta 30 y de 2,5 hasta 40. Avanzar «un 2,5 % más» aterriza en un peso que
 * puede no existir en la estantería.
 *
 * Lo que fijan estos tests es lo que decide si la sugerencia es montable:
 * avanzar al **siguiente peldaño que de verdad existe** y bajar aterrizando en
 * un peldaño, nunca entre dos.
 */

import { describe, it, expect } from 'vitest';
import {
  loadMovesForExercise,
  loadStepForExercise,
  nextStepAbove,
  normalizeSteps,
  stepAtOrBelow,
} from '../loadStep';

/** Mancuernas reales: finas hasta 30, luego de 2,5 en 2,5 hasta 40. */
const MANCUERNAS = [
  0.5, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40,
];

describe('normalizeSteps', () => {
  it('ordena, deduplica y tira lo que no es un peso usable', () => {
    expect(normalizeSteps([10, 2.5, 10, 5])).toEqual([2.5, 5, 10]);
    expect(normalizeSteps([5, -5, 0, Number.NaN, 2.5])).toEqual([2.5, 5]);
  });

  it('una tabla vacía o ausente da lista vacía, no un error', () => {
    expect(normalizeSteps([])).toEqual([]);
    expect(normalizeSteps(null)).toEqual([]);
    expect(normalizeSteps(undefined)).toEqual([]);
  });
});

describe('stepAtOrBelow', () => {
  it('devuelve el peldaño más alto que no pasa del peso', () => {
    expect(stepAtOrBelow(16, MANCUERNAS)).toBe(15);
    expect(stepAtOrBelow(15, MANCUERNAS)).toBe(15);
  });

  it('por debajo del peldaño más fino no hay nada', () => {
    expect(stepAtOrBelow(0.25, MANCUERNAS)).toBeUndefined();
  });
});

describe('nextStepAbove', () => {
  it('sube al siguiente peldaño real, no a un múltiplo', () => {
    // 16 no es una mancuerna: la siguiente de la escalera es la de 17,5.
    expect(nextStepAbove(16, MANCUERNAS)).toBe(17.5);
  });

  it('salta el hueco gordo de arriba: de 30 a 32,5, no a 33', () => {
    expect(nextStepAbove(30, MANCUERNAS)).toBe(32.5);
  });

  it('en el techo devuelve null, que significa «toca sumar reps»', () => {
    expect(nextStepAbove(40, MANCUERNAS)).toBeNull();
    expect(nextStepAbove(45, MANCUERNAS)).toBeNull();
  });

  it('con tabla vacía no hay a dónde subir', () => {
    expect(nextStepAbove(20, [])).toBeNull();
  });
});

describe('loadMovesForExercise', () => {
  it('mancuerna con tabla: sube y baja por la escalera real', () => {
    const moves = loadMovesForExercise('dumbbell', { dumbbellStepsKg: MANCUERNAS });

    expect(moves.nextUp?.(16)).toBe(17.5);
    // Al bajar se aterriza en el peldaño que no pasa del peso reducido: caer
    // entre dos peldaños no es una opción.
    expect(moves.downTo?.(16)).toBe(15);
  });

  it('máquina con tabla: su propia escalera, no la de las mancuernas', () => {
    const moves = loadMovesForExercise('leverage machine', {
      dumbbellStepsKg: MANCUERNAS,
      machineStepsKg: [2.5, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100],
    });

    expect(moves.nextUp?.(42)).toBe(50);
  });

  it('sin tabla devuelve vacío: el motor se queda con múltiplos, no rompe', () => {
    expect(loadMovesForExercise('dumbbell', {})).toEqual({});
    expect(loadMovesForExercise('barbell', { platesKg: [20, 10, 5] })).toEqual({});
  });
});

describe('loadStepForExercise con tabla', () => {
  it('con tabla llena manda el peldaño más fino de la tabla', () => {
    expect(loadStepForExercise('dumbbell', { dumbbellStepsKg: MANCUERNAS })).toBe(0.5);
  });

  it('sin tabla se cae al número suelto de siempre (ajustes guardados)', () => {
    expect(loadStepForExercise('dumbbell', { dumbbellStepsKg: [], dumbbellStepKg: 2 })).toBe(2);
  });
});
