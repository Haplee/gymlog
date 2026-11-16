import { describe, expect, it } from 'vitest';
import { getPriorSetsSameMuscle } from '../sessionContext';

const session = [
  { name: 'Press horizontal', muscleGroup: 'Pecho', sets: 2 },
  { name: 'Aperturas', muscleGroup: 'Pecho', sets: 3 },
  { name: 'Press banca', muscleGroup: 'Pecho', sets: 4 },
];

describe('getPriorSetsSameMuscle', () => {
  it('no cuenta series previas para el primer ejercicio', () => {
    expect(getPriorSetsSameMuscle(1, session)).toBe(0);
  });

  it('suma las series del mismo grupo muscular hechas antes', () => {
    expect(getPriorSetsSameMuscle(3, session)).toBe(5);
  });

  it('devuelve cero cuando el grupo muscular es distinto', () => {
    const differentMuscle = [
      { name: 'Press banca', muscleGroup: 'Pecho', sets: 2 },
      { name: 'Remo', muscleGroup: 'Espalda', sets: 3 },
      { name: 'Press militar', muscleGroup: 'Hombro', sets: 4 },
    ];
    expect(getPriorSetsSameMuscle(3, differentMuscle)).toBe(0);
  });
});
