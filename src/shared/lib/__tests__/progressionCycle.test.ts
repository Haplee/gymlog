import { describe, expect, it } from 'vitest';
import {
  advanceProgression,
  createInitialProgression,
  deriveProgressionEvent,
  normalizeExerciseName,
  parseRepRange,
  suggestedPrefillWeight,
  DEFAULT_DELOAD_CYCLE_LENGTH,
  DEFAULT_DELOAD_FRACTION,
  type ProgressionState,
} from '../progressionCycle';

const base = (overrides: Partial<ProgressionState> = {}): ProgressionState => ({
  exerciseName: 'Press banca',
  repMin: 8,
  repMax: 12,
  incrementKg: 2.5,
  bodyweight: false,
  currentWeight: 80,
  currentReps: 10,
  sessionCount: 3,
  nextDeloadWeek: 1,
  isDeloadWeek: false,
  updatedAt: '2026-08-05T10:00:00.000Z',
  ...overrides,
});

describe('normalizeExerciseName', () => {
  it('normaliza mayúsculas, acentos y espacios', () => {
    expect(normalizeExerciseName('Press Banca')).toBe('press banca');
    expect(normalizeExerciseName(' BÍCEPS ')).toBe('biceps');
    expect(normalizeExerciseName('Extensión tríceps')).toBe('extension triceps');
  });
});

describe('parseRepRange', () => {
  it('extrae el rango de un objetivo de reps', () => {
    expect(parseRepRange('8-10')).toEqual({ repMin: 8, repMax: 10 });
    expect(parseRepRange('5')).toEqual({ repMin: 5, repMax: 5 });
    expect(parseRepRange('10 por pierna')).toEqual({ repMin: 10, repMax: 10 });
    expect(parseRepRange('30-45s')).toEqual({ repMin: 30, repMax: 45 });
  });

  it('devuelve rango vacío sin objetivo', () => {
    expect(parseRepRange(undefined)).toEqual({});
    expect(parseRepRange('al fallo')).toEqual({});
  });
});

describe('createInitialProgression', () => {
  it('fija la carga de trabajo de la primera sesión', () => {
    const state = createInitialProgression('Press banca', { weight: 82.5, reps: 8 }, {});
    expect(state.currentWeight).toBe(82.5);
    expect(state.currentReps).toBe(8);
    expect(state.sessionCount).toBe(1);
    expect(state.isDeloadWeek).toBe(false);
    expect(state.nextDeloadWeek).toBe(DEFAULT_DELOAD_CYCLE_LENGTH - 1);
  });

  it('respeta la configuración del ciclo', () => {
    const state = createInitialProgression(
      'Dominadas',
      { weight: 0, reps: 10 },
      { bodyweight: true, cycleLength: 4, incrementKg: 1 },
    );
    expect(state.bodyweight).toBe(true);
    expect(state.nextDeloadWeek).toBe(3);
    expect(state.incrementKg).toBe(1);
  });
});

describe('advanceProgression', () => {
  it('progresa por repeticiones dentro del rango', () => {
    const next = advanceProgression(base(), { weight: 80, reps: 10 }, {});
    expect(next.currentWeight).toBe(80);
    expect(next.currentReps).toBe(11);
    expect(next.sessionCount).toBe(4);
  });

  it('sube carga y vuelve al suelo del rango al alcanzar el techo', () => {
    const next = advanceProgression(base({ currentReps: 12 }), { weight: 80, reps: 12 }, {});
    expect(next.currentWeight).toBe(82.5);
    expect(next.currentReps).toBe(8);
  });

  it('en peso corporal nunca sube carga, solo repeticiones', () => {
    const next = advanceProgression(
      base({ bodyweight: true, currentWeight: 0, currentReps: 15, repMax: 12 }),
      { weight: 0, reps: 15 },
      {},
    );
    expect(next.currentWeight).toBe(0);
    expect(next.currentReps).toBe(16);
  });

  it('programa la descarga al agotarse el contador', () => {
    let state = createInitialProgression(
      'Press banca',
      { weight: 80, reps: 8 },
      { repMin: 8, repMax: 10 },
    );
    expect(state.nextDeloadWeek).toBe(DEFAULT_DELOAD_CYCLE_LENGTH - 1);
    for (let i = 0; i < DEFAULT_DELOAD_CYCLE_LENGTH - 1; i++) {
      state = advanceProgression(state, { weight: 80, reps: 8 }, {});
    }
    expect(state.isDeloadWeek).toBe(true);
    expect(state.nextDeloadWeek).toBe(0);
  });

  it('la semana de descarga se cierra y reanuda el ciclo con la carga previa', () => {
    const loading = advanceProgression(
      base({ isDeloadWeek: false, nextDeloadWeek: 0 }),
      { weight: 85, reps: 10 },
      {},
    );
    expect(loading.isDeloadWeek).toBe(true);

    const deloadSession = advanceProgression(loading, { weight: 56, reps: 10 }, {});
    expect(deloadSession.isDeloadWeek).toBe(false);
    expect(deloadSession.sessionCount).toBe(0);
    expect(deloadSession.nextDeloadWeek).toBe(DEFAULT_DELOAD_CYCLE_LENGTH - 1);
    expect(deloadSession.currentWeight).toBe(85);
  });
});

describe('deriveProgressionEvent', () => {
  it('detecta subida de carga y suma de repeticiones', () => {
    expect(deriveProgressionEvent(base(), base({ currentWeight: 82.5 }))).toBe('increase');
    expect(deriveProgressionEvent(base(), base({ currentReps: 11 }))).toBe('add-reps');
    expect(deriveProgressionEvent(base(), base({ currentReps: 10 }))).toBeNull();
  });

  it('detecta inicio y fin de descarga', () => {
    expect(deriveProgressionEvent(base(), base({ isDeloadWeek: true }))).toBe('deload-start');
    expect(
      deriveProgressionEvent(base({ isDeloadWeek: true }), base({ isDeloadWeek: false })),
    ).toBe('deload-end');
  });
});

describe('suggestedPrefillWeight', () => {
  it('usa la carga del ciclo si existe', () => {
    expect(suggestedPrefillWeight(base({ currentWeight: 82.5 }), 80)).toBe(82.5);
  });

  it('sin ciclo usa el último peso de la última sesión', () => {
    expect(suggestedPrefillWeight(null, 80)).toBe(80);
  });

  it('sin nada no inventa un peso', () => {
    expect(suggestedPrefillWeight(null, null)).toBeNull();
  });

  it('durante la descarga reduce la carga y la redondea al escalón', () => {
    const state = base({ isDeloadWeek: true, currentWeight: 80 });
    const expected = Math.round(Math.round((80 * DEFAULT_DELOAD_FRACTION) / 2.5) * 2.5 * 100) / 100;
    expect(suggestedPrefillWeight(state, 80)).toBe(expected);
  });

  it('la descarga sin carga previa cae sobre el último peso', () => {
    const state = base({ isDeloadWeek: true, currentWeight: undefined });
    const expected = Math.round(Math.round((80 * DEFAULT_DELOAD_FRACTION) / 2.5) * 2.5 * 100) / 100;
    expect(suggestedPrefillWeight(state, 80)).toBe(expected);
  });
});

describe('advanceProgression — el esquema completo manda sobre la mejor serie', () => {
  it('con series por debajo del techo consolida la carga en vez de subirla', () => {
    const state = base({ currentWeight: 80, currentReps: 12 });
    const next = advanceProgression(state, {
      weight: 80,
      reps: 12,
      sessionReps: [12, 9, 8],
    });

    expect(next.currentWeight).toBe(80);
    expect(next.currentReps).toBe(12);
    // La sesión cuenta para el ciclo aunque el peso no se mueva.
    expect(next.sessionCount).toBe(state.sessionCount + 1);
  });

  it('con todas las series en el techo sí sube un escalón', () => {
    const state = base({ currentWeight: 80, currentReps: 12 });
    const next = advanceProgression(state, {
      weight: 80,
      reps: 12,
      sessionReps: [12, 12, 12],
    });

    expect(next.currentWeight).toBe(82.5);
    expect(next.currentReps).toBe(8);
  });

  it('sin detalle de series se comporta como antes: no penaliza a quien anota poco', () => {
    const state = base({ currentWeight: 80, currentReps: 12 });
    const next = advanceProgression(state, { weight: 80, reps: 12 });

    expect(next.currentWeight).toBe(82.5);
  });
});
