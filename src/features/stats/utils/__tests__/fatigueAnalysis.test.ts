import { describe, it, expect } from 'vitest';
import { analyzeMuscleRecovery } from '../fatigueAnalysis';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe('analyzeMuscleRecovery', () => {
  it('agrupa por muscle_group único sin mapa (retrocompatible)', () => {
    const sets = [
      { exercise: { muscle_group: 'Pecho' }, workout: { started_at: daysAgo(1) } },
      { exercise: { muscle_group: 'Espalda' }, workout: { started_at: daysAgo(6) } },
    ];
    const result = analyzeMuscleRecovery(sets);
    const pecho = result.find((r) => r.name === 'Pecho');
    const espalda = result.find((r) => r.name === 'Espalda');
    expect(pecho?.status).toBe('fresh');
    expect(espalda?.status).toBe('needs-attention');
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
    expect(result.every((r) => r.status === 'fresh')).toBe(true);
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
    expect(result[0].status).toBe('fresh');
  });

  it('devuelve Otro/needs-attention si no hay sets', () => {
    const result = analyzeMuscleRecovery([]);
    expect(result[0].name).toBe('Otro');
    expect(result[0].status).toBe('needs-attention');
  });
});
