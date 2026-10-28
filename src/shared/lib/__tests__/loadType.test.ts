import { describe, it, expect } from 'vitest';
import { isBodyweightLoad, loadTypeFromEquipment, pideCargaExterna, LOAD_TYPES } from '../loadType';

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

describe('pideCargaExterna', () => {
  it('solo exige peso cuando la modalidad es carga externa', () => {
    expect(pideCargaExterna('external')).toBe(true);
    expect(pideCargaExterna('bodyweight')).toBe(false);
    expect(pideCargaExterna('bodyweight_loaded')).toBe(false);
  });

  it('no lo exige cuando no hay modalidad conocida', () => {
    // Un ejercicio que no está en el catálogo no es «de kilos»: es un ejercicio
    // del que no sabemos nada. Darlo por externo dejaba la rutina sin poder
    // terminar (el plan ya trae las repeticiones y no hay peso que escribir).
    expect(pideCargaExterna(null)).toBe(false);
    expect(pideCargaExterna(undefined)).toBe(false);
    expect(pideCargaExterna('')).toBe(false);
    expect(pideCargaExterna('otra_cosa')).toBe(false);
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
