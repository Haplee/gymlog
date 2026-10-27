import { describe, it, expect } from 'vitest';
import {
  MAX_DURATION_SECONDS,
  MAX_REPS,
  isBlankSetRow,
  isImplausibleSetWeight,
  isSetRowIntended,
  parseDurationSeconds,
  parseReps,
  parseSetWeight,
  selectSetsForSave,
  validateSetsForSave,
} from '../setValidation';

describe('parseReps', () => {
  it('acepta enteros positivos, con espacios alrededor', () => {
    expect(parseReps('8')).toBe(8);
    expect(parseReps(' 12 ')).toBe(12);
    expect(parseReps('01')).toBe(1);
  });

  it('rechaza lo que la RPC descartaría en silencio', () => {
    expect(parseReps('10.5')).toBeNull();
    expect(parseReps('1e3')).toBeNull();
    expect(parseReps('0')).toBeNull();
    expect(parseReps('-5')).toBeNull();
    expect(parseReps('diez')).toBeNull();
    expect(parseReps('')).toBeNull();
    expect(parseReps(undefined)).toBeNull();
  });

  it('aplica el techo de la app', () => {
    expect(parseReps(String(MAX_REPS))).toBe(MAX_REPS);
    expect(parseReps(String(MAX_REPS + 1))).toBeNull();
  });
});

describe('parseDurationSeconds', () => {
  it('acepta segundos enteros dentro del rango', () => {
    expect(parseDurationSeconds('45')).toBe(45);
    expect(parseDurationSeconds(String(MAX_DURATION_SECONDS))).toBe(MAX_DURATION_SECONDS);
  });

  it('rechaza cero, decimales y valores fuera del rango', () => {
    expect(parseDurationSeconds('0')).toBeNull();
    expect(parseDurationSeconds('45.5')).toBeNull();
    expect(parseDurationSeconds(String(MAX_DURATION_SECONDS + 1))).toBeNull();
    expect(parseDurationSeconds('')).toBeNull();
  });
});

describe('parseSetWeight', () => {
  it('un peso vacío es 0: serie sin lastre, no fila a medias', () => {
    expect(parseSetWeight('')).toBe(0);
    expect(parseSetWeight('   ')).toBe(0);
    expect(parseSetWeight(undefined)).toBe(0);
  });

  it('acepta cero y decimales', () => {
    expect(parseSetWeight('0')).toBe(0);
    expect(parseSetWeight('82.5')).toBe(82.5);
  });

  it('rechaza negativos y texto que no es número', () => {
    expect(parseSetWeight('-5')).toBeNull();
    expect(parseSetWeight('ochenta')).toBeNull();
    expect(parseSetWeight('Infinity')).toBeNull();
  });
});

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

describe('isSetRowIntended', () => {
  it('una fila con repeticiones es intención aunque no tenga peso', () => {
    expect(isSetRowIntended({ reps: '12', weight: '' })).toBe(true);
    expect(isSetRowIntended({ reps: '12', weight: '0' })).toBe(true);
  });

  it('la fila que abre la app sola no cuenta hasta que se toca o se marca', () => {
    expect(isSetRowIntended({ reps: '10', weight: '60', autofilled: true })).toBe(false);
    expect(isSetRowIntended({ reps: '10', weight: '60', autofilled: true, completed: true })).toBe(
      true,
    );
  });

  it('una fila en blanco no cuenta', () => {
    expect(isSetRowIntended({ reps: '', weight: '', durationSeconds: '' })).toBe(false);
  });
});

describe('selectSetsForSave', () => {
  it('acepta una serie de repeticiones sin peso como serie de 0 kg', () => {
    const { selected, errors, hasValid } = selectSetsForSave([{ reps: '12', weight: '' }]);

    expect(errors).toEqual({});
    expect(hasValid).toBe(true);
    expect(selected).toEqual([{ index: 0, reps: 12, durationSeconds: null, weightKg: 0 }]);
  });

  it('acepta una serie por tiempo sin peso y con reps vacías', () => {
    const { selected, errors } = selectSetsForSave([
      { reps: '', weight: '', durationSeconds: '48' },
    ]);

    expect(errors).toEqual({});
    expect(selected).toEqual([{ index: 0, reps: null, durationSeconds: 48, weightKg: 0 }]);
  });

  it('marca cada fila mal escrita con su motivo, sin descartarla en silencio', () => {
    const { selected, errors } = selectSetsForSave([
      { reps: '8', weight: '80' },
      { reps: '', weight: '80' }, // no mide nada
      { reps: '10.5', weight: '60' }, // reps no enteras
      { reps: '', weight: '60', durationSeconds: '9999' }, // segundos fuera de rango
      { reps: '8', weight: '-5' }, // peso negativo
    ]);

    expect(selected.map((s) => s.index)).toEqual([0]);
    expect(errors).toEqual({
      1: 'workout.errors.needs_measure',
      2: 'workout.errors.reps_invalid',
      3: 'workout.errors.duration_invalid',
      4: 'workout.errors.weight_negative',
    });
  });

  it('salta las filas en blanco en vez de marcarlas en rojo', () => {
    const { errors, hasValid } = selectSetsForSave([
      { reps: '', weight: '', durationSeconds: '' },
      { reps: '8', weight: '80' },
    ]);
    expect(errors).toEqual({});
    expect(hasValid).toBe(true);
  });

  it('sin ninguna fila válida devuelve hasValid false', () => {
    const { errors, hasValid } = selectSetsForSave([
      { reps: '', weight: '', durationSeconds: '' },
      { reps: '', weight: '80' },
    ]);
    expect(errors).toEqual({ 1: 'workout.errors.needs_measure' });
    expect(hasValid).toBe(false);
  });

  it('con onlyCompleted ignora las filas no marcadas', () => {
    const { errors, hasValid } = selectSetsForSave(
      [
        { reps: '', weight: '80', completed: false }, // rota, pero se ignora
        { reps: '8', weight: '80', completed: true },
      ],
      { onlyCompleted: true },
    );
    expect(errors).toEqual({});
    expect(hasValid).toBe(true);
  });

  it('con onlyCompleted, una fila marcada sin medida sí falla', () => {
    const { errors } = selectSetsForSave([{ reps: '', weight: '80', completed: true }], {
      onlyCompleted: true,
    });
    expect(errors).toEqual({ 0: 'workout.errors.needs_measure' });
  });

  it('lista vacía: sin errores y sin válidas', () => {
    expect(selectSetsForSave([])).toEqual({ selected: [], errors: {}, hasValid: false });
  });
});

describe('validateSetsForSave', () => {
  it('es la vista de solo errores de selectSetsForSave', () => {
    const sets = [
      { reps: '8', weight: '80' },
      { reps: '', weight: '80' },
    ];
    expect(validateSetsForSave(sets, false)).toEqual({
      errors: { 1: 'workout.errors.needs_measure' },
      hasValid: true,
    });
  });

  it('sin filas válidas no hay nada que guardar', () => {
    expect(validateSetsForSave([{ reps: '', weight: '80' }], false)).toEqual({
      errors: { 0: 'workout.errors.needs_measure' },
      hasValid: false,
    });
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
