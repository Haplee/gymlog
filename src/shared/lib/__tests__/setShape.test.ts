import { describe, it, expect } from 'vitest';
import {
  isRepSet,
  isTimedSet,
  onlyRepSets,
  onlyTimedSets,
  repsOf,
  durationOf,
  isMeasuredSet,
  modeOfPlanned,
} from '../setShape';

describe('isRepSet', () => {
  it('reconoce una serie de repeticiones', () => {
    expect(isRepSet({ reps: 10, weight: 80 })).toBe(true);
  });

  it('una serie sin repeticiones no lo es', () => {
    expect(isRepSet({ reps: null })).toBe(false);
    expect(isRepSet({})).toBe(false);
  });

  it('cero repeticiones no es una serie de repeticiones', () => {
    // Es el caso que un `reps ?? 0` convertiría en dato válido.
    expect(isRepSet({ reps: 0 })).toBe(false);
  });

  it('descarta valores imposibles en vez de propagarlos', () => {
    expect(isRepSet({ reps: NaN })).toBe(false);
    expect(isRepSet({ reps: Infinity })).toBe(false);
    expect(isRepSet({ reps: -5 })).toBe(false);
  });

  it('una serie con reps y duración sigue siendo de repeticiones', () => {
    // Cronometrar 10 sentadillas no las convierte en una plancha.
    expect(isRepSet({ reps: 10, duration_seconds: 45 })).toBe(true);
    expect(isTimedSet({ reps: 10, duration_seconds: 45 })).toBe(false);
  });
});

describe('isTimedSet', () => {
  it('reconoce una serie por tiempo', () => {
    expect(isTimedSet({ reps: null, duration_seconds: 45 })).toBe(true);
  });

  it('sin duración no lo es', () => {
    expect(isTimedSet({ reps: null, duration_seconds: null })).toBe(false);
    expect(isTimedSet({ reps: null, duration_seconds: 0 })).toBe(false);
  });
});

describe('onlyRepSets', () => {
  it('deja fuera lo que no se mide en repeticiones', () => {
    const sets = [
      { reps: 10, weight: 80 },
      { reps: null, duration_seconds: 45, weight: 0 },
      { reps: 8, weight: 82.5 },
    ];
    expect(onlyRepSets(sets)).toHaveLength(2);
  });

  it('estrecha el tipo: reps deja de ser nullable', () => {
    const sets: { reps: number | null; weight: number }[] = [
      { reps: 10, weight: 80 },
      { reps: null, weight: 0 },
    ];
    // Sin narrowing esto no compilaría; la aritmética es la prueba.
    const volumen = onlyRepSets(sets).reduce((suma, s) => suma + s.reps * s.weight, 0);
    expect(volumen).toBe(800);
  });

  it('una serie por tiempo no aporta cero al volumen: no aporta nada', () => {
    const sets = [
      { reps: 10, weight: 80 },
      { reps: null, duration_seconds: 60, weight: 0 },
    ];
    const soloReps = onlyRepSets(sets);
    // Lo que importa no es la suma (0 × 0 = 0 igualmente), es el recuento:
    // una media dividiría entre 2 en vez de entre 1.
    expect(soloReps).toHaveLength(1);
  });

  it('hoy, con todo NOT NULL, no filtra nada', () => {
    const sets = [
      { reps: 10, weight: 80 },
      { reps: 8, weight: 80 },
    ];
    expect(onlyRepSets(sets)).toHaveLength(2);
  });
});

describe('onlyTimedSets', () => {
  it('se queda solo con las de tiempo', () => {
    const sets = [
      { reps: 10, weight: 80 },
      { reps: null, duration_seconds: 45, weight: 0 },
    ];
    const timed = onlyTimedSets(sets);
    expect(timed).toHaveLength(1);
    expect(timed[0].duration_seconds).toBe(45);
  });
});

describe('repsOf / durationOf', () => {
  it('devuelven null en vez de cero cuando no aplica', () => {
    expect(repsOf({ reps: null, duration_seconds: 45 })).toBeNull();
    expect(durationOf({ reps: 10 })).toBeNull();
  });

  it('devuelven el valor cuando aplica', () => {
    expect(repsOf({ reps: 12 })).toBe(12);
    expect(durationOf({ reps: null, duration_seconds: 30 })).toBe(30);
  });
});

describe('isMeasuredSet', () => {
  it('una serie sin reps y sin duración está rota', () => {
    expect(isMeasuredSet({ reps: null, duration_seconds: null })).toBe(false);
    expect(isMeasuredSet({})).toBe(false);
  });

  it('con cualquiera de las dos, vale', () => {
    expect(isMeasuredSet({ reps: 5 })).toBe(true);
    expect(isMeasuredSet({ reps: null, duration_seconds: 20 })).toBe(true);
  });
});

describe('modeOfPlanned', () => {
  it('la ausencia se lee como repeticiones', () => {
    // Es la regla que hace que ninguna rutina guardada necesite migrarse.
    expect(modeOfPlanned({})).toBe('reps');
    expect(modeOfPlanned(null)).toBe('reps');
    expect(modeOfPlanned(undefined)).toBe('reps');
    expect(modeOfPlanned({ mode: null })).toBe('reps');
  });

  it('reconoce los modos válidos', () => {
    expect(modeOfPlanned({ mode: 'time' })).toBe('time');
    expect(modeOfPlanned({ mode: 'cardio' })).toBe('cardio');
    expect(modeOfPlanned({ mode: 'reps' })).toBe('reps');
  });

  it('un modo desconocido cae en repeticiones, no revienta', () => {
    // Un fichero de rutina de una versión futura no puede dejar la app inservible.
    expect(modeOfPlanned({ mode: 'holograma' })).toBe('reps');
  });
});
