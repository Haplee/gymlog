import { describe, it, expect } from 'vitest';
import { isBodyweightLoad, loadTypeFromEquipment, LOAD_TYPES } from '../loadType';

describe('isBodyweightLoad', () => {
  it('es true para las dos variantes de peso corporal', () => {
    expect(isBodyweightLoad('bodyweight')).toBe(true);
    expect(isBodyweightLoad('bodyweight_loaded')).toBe(true);
  });

  it('es false para externo y valores ausentes', () => {
    expect(isBodyweightLoad('external')).toBe(false);
    expect(isBodyweightLoad(null)).toBe(false);
    expect(isBodyweightLoad(undefined)).toBe(false);
    expect(isBodyweightLoad('otra_cosa')).toBe(false);
  });
});

describe('loadTypeFromEquipment', () => {
  it('detecta peso corporal por el equipamiento (con o sin espacio)', () => {
    expect(loadTypeFromEquipment(['body weight'])).toBe('bodyweight');
    expect(loadTypeFromEquipment(['Bodyweight'])).toBe('bodyweight');
    expect(loadTypeFromEquipment(['dumbbell', 'body weight'])).toBe('bodyweight');
  });

  it('cae a externo si no hay peso corporal', () => {
    expect(loadTypeFromEquipment(['barbell'])).toBe('external');
    expect(loadTypeFromEquipment([])).toBe('external');
  });
});

describe('LOAD_TYPES', () => {
  it('expone las tres modalidades', () => {
    expect(LOAD_TYPES).toEqual(['external', 'bodyweight', 'bodyweight_loaded']);
  });
});
