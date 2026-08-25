import { describe, it, expect } from 'vitest';
import { planModeOf, planDurationOf, formatSegundos, MAX_DURACION_SEGUNDOS } from '../planTarget';

describe('planModeOf', () => {
  it('un ejercicio sin modo es de repeticiones', () => {
    expect(planModeOf({ name: 'Press banca', sets: 3, reps: '8-10' } as never)).toBe('reps');
  });

  it('undefined y null no revientan', () => {
    expect(planModeOf(undefined)).toBe('reps');
    expect(planModeOf(null)).toBe('reps');
  });

  it('reconoce el modo tiempo', () => {
    expect(planModeOf({ mode: 'time' })).toBe('time');
  });

  it('cardio no es un modo de rutina: cae en reps', () => {
    // Un fichero compartido manipulado podria traerlo. Crear un ejercicio de
    // rutina que ninguna pantalla sabe pintar es peor que ignorar el campo.
    expect(planModeOf({ mode: 'cardio' })).toBe('reps');
  });

  it('un modo inventado cae en reps', () => {
    expect(planModeOf({ mode: 'emom' })).toBe('reps');
  });
});

describe('planDurationOf', () => {
  it('devuelve los segundos de una serie por tiempo', () => {
    expect(planDurationOf({ mode: 'time', durationSeconds: 45 })).toBe(45);
  });

  it('en modo reps no hay duracion aunque el campo venga relleno', () => {
    expect(planDurationOf({ mode: 'reps', durationSeconds: 45 })).toBeNull();
    expect(planDurationOf({ durationSeconds: 45 })).toBeNull();
  });

  it('cero no es una duracion', () => {
    expect(planDurationOf({ mode: 'time', durationSeconds: 0 })).toBeNull();
  });

  it('descarta negativos, NaN y lo que se pase de la hora', () => {
    expect(planDurationOf({ mode: 'time', durationSeconds: -30 })).toBeNull();
    expect(planDurationOf({ mode: 'time', durationSeconds: Number.NaN })).toBeNull();
    expect(planDurationOf({ mode: 'time', durationSeconds: MAX_DURACION_SEGUNDOS + 1 })).toBeNull();
  });

  it('trunca los decimales', () => {
    expect(planDurationOf({ mode: 'time', durationSeconds: 45.9 })).toBe(45);
  });

  it('sin duracion devuelve null, no cero', () => {
    expect(planDurationOf({ mode: 'time' })).toBeNull();
  });
});

describe('formatSegundos', () => {
  it('por debajo del minuto, segundos pelados', () => {
    expect(formatSegundos(45)).toBe('45 s');
    expect(formatSegundos(59)).toBe('59 s');
  });

  it('a partir del minuto, m:ss', () => {
    expect(formatSegundos(60)).toBe('1:00');
    expect(formatSegundos(90)).toBe('1:30');
    expect(formatSegundos(605)).toBe('10:05');
  });
});
