import { describe, it, expect } from 'vitest';
import {
  isBlankSetRow,
  isImplausibleSetWeight,
  setSchema,
  validateSetsForSave,
} from '../setValidation';

describe('isBlankSetRow', () => {
  it('considera en blanco una fila sin reps, peso ni duración', () => {
    expect(isBlankSetRow({ reps: '', weight: '', durationSeconds: '' })).toBe(true);
    // Los campos ausentes también cuentan como vacíos.
    expect(isBlankSetRow({})).toBe(true);
  });

  it('un «0» es vacío para esta comprobación', () => {
    expect(isBlankSetRow({ reps: '0', weight: '0', durationSeconds: '0' })).toBe(true);
  });

  it('cualquier dato escrito la saca de «en blanco»', () => {
    expect(isBlankSetRow({ reps: '8', weight: '', durationSeconds: '' })).toBe(false);
    expect(isBlankSetRow({ reps: '', weight: '80', durationSeconds: '' })).toBe(false);
    expect(isBlankSetRow({ reps: '', weight: '', durationSeconds: '45' })).toBe(false);
  });
});

describe('isImplausibleSetWeight', () => {
  it('un peso normal de gimnasio no pide confirmación', () => {
    expect(isImplausibleSetWeight(0)).toBe(false);
    expect(isImplausibleSetWeight(140)).toBe(false);
    // El umbral se pisa en el límite; solo salta por encima.
    expect(isImplausibleSetWeight(400)).toBe(false);
  });

  it('un peso imposible para una serie sí la pide', () => {
    expect(isImplausibleSetWeight(480)).toBe(true);
  });

  it('un valor vacío o no numérico no pide nada', () => {
    expect(isImplausibleSetWeight(Number(''))).toBe(false);
    expect(isImplausibleSetWeight(NaN)).toBe(false);
    expect(isImplausibleSetWeight(Infinity)).toBe(false);
  });
});

describe('setSchema', () => {
  it('acepta una serie de repeticiones', () => {
    expect(setSchema.safeParse({ reps: '8', weight: '80', durationSeconds: '' }).success).toBe(
      true,
    );
  });

  it('acepta una serie por tiempo sin peso', () => {
    expect(setSchema.safeParse({ reps: '', weight: '0', durationSeconds: '48' }).success).toBe(
      true,
    );
  });

  it('rechaza una fila que no mide nada (ni reps ni segundos)', () => {
    const result = setSchema.safeParse({ reps: '', weight: '80', durationSeconds: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe('workout.errors.needs_measure');
    }
  });

  it('rechaza peso negativo con su clave de i18n', () => {
    const result = setSchema.safeParse({ reps: '8', weight: '-5', durationSeconds: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe('workout.errors.weight_negative');
    }
  });
});

describe('validateSetsForSave', () => {
  it('marca el índice de cada fila inválida y deja pasar las válidas', () => {
    const { errors, hasValid } = validateSetsForSave(
      [
        { reps: '8', weight: '80' },
        { reps: '', weight: '80' }, // no mide nada
        { reps: '10', weight: '60' },
      ],
      false,
    );
    expect(errors).toEqual({ 1: 'workout.errors.needs_measure' });
    expect(hasValid).toBe(true);
  });

  it('salta las filas en blanco en vez de marcarlas en rojo', () => {
    const { errors, hasValid } = validateSetsForSave(
      [
        { reps: '', weight: '', durationSeconds: '' },
        { reps: '8', weight: '80' },
      ],
      false,
    );
    expect(errors).toEqual({});
    expect(hasValid).toBe(true);
  });

  it('sin ninguna fila válida devuelve hasValid false', () => {
    const { errors, hasValid } = validateSetsForSave(
      [
        { reps: '', weight: '', durationSeconds: '' },
        { reps: '', weight: '80' },
      ],
      false,
    );
    expect(errors).toEqual({ 1: 'workout.errors.needs_measure' });
    expect(hasValid).toBe(false);
  });

  it('con onlyCompleted ignora las filas no marcadas', () => {
    const { errors, hasValid } = validateSetsForSave(
      [
        { reps: '', weight: '80', completed: false }, // rota, pero se ignora
        { reps: '8', weight: '80', completed: true },
      ],
      true,
    );
    expect(errors).toEqual({});
    expect(hasValid).toBe(true);
  });

  it('con onlyCompleted, una fila marcada sin medida sí falla', () => {
    const { errors } = validateSetsForSave([{ reps: '', weight: '80', completed: true }], true);
    expect(errors).toEqual({ 0: 'workout.errors.needs_measure' });
  });

  it('lista vacía: sin errores y sin válidas', () => {
    expect(validateSetsForSave([], false)).toEqual({ errors: {}, hasValid: false });
  });
});
