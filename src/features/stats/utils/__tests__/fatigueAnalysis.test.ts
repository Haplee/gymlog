import { describe, it, expect } from 'vitest';
import {
  analyzeMuscleRecovery,
  getSuggestedMuscleGroup,
  recoveryStatusFor,
} from '../fatigueAnalysis';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe('recoveryStatusFor', () => {
  // El bug QA-07 vivía justo aquí: un músculo entrenado hoy se rotulaba
  // "Recuperado". Más días sin entrenar ⇒ más recuperado, nunca al revés.
  it('un músculo entrenado hoy NO está recuperado', () => {
    expect(recoveryStatusFor(0)).toBe('recovering');
  });

  it('mapea los umbrales de días a estado de recuperación', () => {
    expect(recoveryStatusFor(0)).toBe('recovering');
    expect(recoveryStatusFor(2)).toBe('recovering');
    expect(recoveryStatusFor(3)).toBe('partial');
    expect(recoveryStatusFor(4)).toBe('partial');
    expect(recoveryStatusFor(5)).toBe('recovered');
    expect(recoveryStatusFor(30)).toBe('recovered');
  });

  it('sin datos (-1) cuenta como recuperado: nunca se ha entrenado', () => {
    expect(recoveryStatusFor(-1)).toBe('recovered');
  });

  it('es monótono: más días nunca implica menos recuperación', () => {
    const rank = { recovering: 0, partial: 1, recovered: 2 } as const;
    for (let d = 1; d <= 14; d++) {
      expect(rank[recoveryStatusFor(d)]).toBeGreaterThanOrEqual(rank[recoveryStatusFor(d - 1)]);
    }
  });
});

describe('analyzeMuscleRecovery', () => {
  it('agrupa por muscle_group único sin mapa (retrocompatible)', () => {
    const sets = [
      { exercise: { muscle_group: 'Pecho' }, workout: { started_at: daysAgo(1) } },
      { exercise: { muscle_group: 'Espalda' }, workout: { started_at: daysAgo(6) } },
    ];
    const result = analyzeMuscleRecovery(sets);
    const pecho = result.find((r) => r.name === 'Pecho');
    const espalda = result.find((r) => r.name === 'Espalda');
    // Pecho se entrenó ayer → aún se recupera. Espalda hace 6 días → lista.
    expect(pecho?.status).toBe('recovering');
    expect(espalda?.status).toBe('recovered');
  });

  it('cuenta una serie para todos los músculos del ejercicio con mapa', () => {
    const sets = [
      {
        exercise_id: 'x',
        exercise: { muscle_group: 'Espalda' },
        workout: { started_at: daysAgo(1) },
      },
    ];
    const map = {
      x: [
        { muscle_group: 'Espalda', role: 'primary' as const, weight: 60 },
        { muscle_group: 'Glúteo', role: 'secondary' as const, weight: 40 },
      ],
    };
    const result = analyzeMuscleRecovery(sets, map);
    const names = result.map((r) => r.name).sort();
    expect(names).toEqual(['Espalda', 'Glúteo']);
    expect(result.every((r) => r.status === 'recovering')).toBe(true);
  });

  it('toma la fecha más reciente por músculo', () => {
    const sets = [
      {
        exercise_id: 'x',
        exercise: { muscle_group: 'Espalda' },
        workout: { started_at: daysAgo(10) },
      },
      {
        exercise_id: 'x',
        exercise: { muscle_group: 'Espalda' },
        workout: { started_at: daysAgo(1) },
      },
    ];
    const map = { x: [{ muscle_group: 'Espalda', role: 'primary' as const, weight: 100 }] };
    const result = analyzeMuscleRecovery(sets, map);
    expect(result[0].daysSinceLast).toBe(1);
    expect(result[0].status).toBe('recovering');
  });

  it('devuelve Otro/recovered si no hay sets', () => {
    const result = analyzeMuscleRecovery([]);
    expect(result[0].name).toBe('Otro');
    expect(result[0].status).toBe('recovered');
  });
});

describe('getSuggestedMuscleGroup', () => {
  it('sugiere un músculo ya recuperado, nunca uno entrenado hoy', () => {
    const sets = [
      { exercise: { muscle_group: 'Pecho' }, workout: { started_at: daysAgo(0) } },
      { exercise: { muscle_group: 'Espalda' }, workout: { started_at: daysAgo(9) } },
    ];
    expect(getSuggestedMuscleGroup(analyzeMuscleRecovery(sets))).toBe('Espalda');
  });

  it('no sugiere nada si todo se ha entrenado hace poco', () => {
    const sets = [
      { exercise: { muscle_group: 'Pecho' }, workout: { started_at: daysAgo(0) } },
      { exercise: { muscle_group: 'Espalda' }, workout: { started_at: daysAgo(1) } },
    ];
    expect(getSuggestedMuscleGroup(analyzeMuscleRecovery(sets))).toBeNull();
  });
});
