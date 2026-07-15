import { describe, expect, it } from 'vitest';
import { mapExerciseDbExercise, mapExerciseDbList } from '../mapExercise';
import type { RawExercise } from '@features/workout/api/exercisedb';

const full: RawExercise = {
  exerciseId: '01qpYSe',
  name: 'upward facing dog',
  gifUrl: 'https://static.exercisedb.dev/media/01qpYSe.gif',
  bodyParts: ['back'],
  equipments: ['body weight'],
  targetMuscles: ['spine'],
  secondaryMuscles: ['shoulders', 'chest'],
  instructions: ['Step:1 Lie face down on the floor.', 'Step:2 Place your hands on the floor.'],
};

describe('mapExerciseDbExercise', () => {
  it('maps a full record to the domain model', () => {
    const ex = mapExerciseDbExercise(full);
    expect(ex.id).toBe('01qpYSe');
    expect(ex.source).toBe('exercisedb');
    expect(ex.name).toBe('upward facing dog');
    expect(ex.mediaUrl).toBe('https://static.exercisedb.dev/media/01qpYSe.gif');
    // El vocabulario finito se traduce al español mediante diccionario local.
    expect(ex.equipment).toEqual(['peso corporal']);
    expect(ex.secondaryMuscles).toEqual(['hombros', 'pecho']);
    expect(ex.bodyParts).toEqual(['espalda']);
    expect(ex.targetMuscles).toEqual(['columna']);
  });

  it('strips the "Step:N" prefix from instructions', () => {
    const ex = mapExerciseDbExercise(full);
    expect(ex.instructions).toEqual([
      'Lie face down on the floor.',
      'Place your hands on the floor.',
    ]);
  });

  it('uses safe defaults when optional fields are missing', () => {
    const raw: RawExercise = { exerciseId: 'x', name: 'test' };
    const ex = mapExerciseDbExercise(raw);
    expect(ex.mediaUrl).toBeNull();
    expect(ex.videoUrl).toBeNull();
    expect(ex.bodyParts).toEqual([]);
    expect(ex.targetMuscles).toEqual([]);
    expect(ex.instructions).toEqual([]);
  });

  it('falls back to imageUrl when gifUrl is absent', () => {
    const raw: RawExercise = { exerciseId: 'x', name: 'test', imageUrl: 'http://img/a.png' };
    expect(mapExerciseDbExercise(raw).mediaUrl).toBe('http://img/a.png');
  });

  it('maps a list', () => {
    expect(mapExerciseDbList([full])).toHaveLength(1);
  });
});
