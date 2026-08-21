/**
 * Contexto de volumen semanal.
 *
 * La regla que se prueba aquí es la que le faltaba al motor: la carga de un
 * ejercicio no se decide solo con ese ejercicio, sino con el trabajo que lleva
 * encima el músculo esa semana.
 */

import { describe, it, expect } from 'vitest';
import { applyVolumeContext, buildVolumeContext, type VolumeSet } from '../trainingLoad';
import type { LoadSuggestion } from '../autoregulation';

const AHORA = new Date('2026-08-21T10:00:00.000Z');
const DIA = 86_400_000;
/** Desenvuelve un resultado que el test da por hecho que existe. */
function exigir<T>(value: T | null | undefined, que = 'el resultado'): T {
  if (value === null || value === undefined) throw new Error(`${que} no debería faltar`);
  return value;
}

/** `count` series de `muscle` hace `daysAgo` días. */
function series(muscle: string, daysAgo: number, count: number): VolumeSet[] {
  const date = new Date(AHORA.getTime() - daysAgo * DIA).toISOString();
  return Array.from({ length: count }, () => ({ date, muscleGroup: muscle }));
}

const subida: LoadSuggestion = {
  weight: 102.5,
  baseWeight: 100,
  baseReps: 8,
  reps: 8,
  action: 'increase',
  deltaPct: 2.5,
  reasonKey: 'coach.reason.ceiling',
  confidence: 'medium',
};

describe('buildVolumeContext', () => {
  it('sin datos de ese músculo no frena nada', () => {
    expect(buildVolumeContext(series('espalda', 3, 10), 'pecho', AHORA)).toBeNull();
  });

  it('cuenta la semana en curso aparte de la media de las cuatro', () => {
    const sets = [
      ...series('pecho', 2, 10),
      ...series('pecho', 9, 10),
      ...series('pecho', 16, 10),
      ...series('pecho', 23, 10),
    ];
    const ctx = exigir(buildVolumeContext(sets, 'pecho', AHORA));
    expect(ctx.acuteSets).toBe(10);
    expect(ctx.chronicSets).toBe(10);
    expect(ctx.acwr).toBe(1);
    expect(ctx.zone).toBe('steady');
    expect(ctx.landmark).toBe('productive');
    expect(ctx.holdLoad).toBe(false);
  });

  it('detecta el pico de carga: el doble de lo habitual', () => {
    const sets = [
      ...series('pierna', 1, 20),
      ...series('pierna', 9, 8),
      ...series('pierna', 16, 8),
      ...series('pierna', 23, 8),
    ];
    const ctx = exigir(buildVolumeContext(sets, 'pierna', AHORA));
    expect(ctx.zone).toBe('spike');
    expect(ctx.holdLoad).toBe(true);
    expect(ctx.reasonKey).toBe('coach.reason.volume_spike');
  });

  it('por encima del máximo recuperable frena aunque la semana no sea un pico', () => {
    const sets = [
      ...series('espalda', 2, 24),
      ...series('espalda', 9, 24),
      ...series('espalda', 16, 24),
      ...series('espalda', 23, 24),
    ];
    const ctx = exigir(buildVolumeContext(sets, 'espalda', AHORA));
    expect(ctx.acwr).toBe(1);
    expect(ctx.landmark).toBe('above-mrv');
    expect(ctx.holdLoad).toBe(true);
  });

  it('un cociente alto sobre volumen ridículo no cuenta como pico', () => {
    // De 1 serie semanal a 4: el cociente se dispara y no significa nada.
    const sets = [...series('gemelo', 1, 4), ...series('gemelo', 9, 1), ...series('gemelo', 16, 1)];
    const ctx = exigir(buildVolumeContext(sets, 'gemelo', AHORA));
    expect(ctx.holdLoad).toBe(false);
    expect(ctx.landmark).toBe('below-mev');
    expect(ctx.reasonKey).toBe('coach.reason.volume_below_mev');
  });

  it('volviendo de un parón el cociente queda bajo, pero no frena', () => {
    const sets = [
      ...series('hombro', 2, 2),
      ...series('hombro', 9, 8),
      ...series('hombro', 16, 8),
      ...series('hombro', 23, 6),
    ];
    const ctx = exigir(buildVolumeContext(sets, 'hombro', AHORA));
    expect(ctx.zone).toBe('detrained');
    expect(ctx.holdLoad).toBe(false);
  });

  it('ignora lo que cae fuera de la ventana de cuatro semanas', () => {
    const sets = [...series('biceps', 3, 6), ...series('biceps', 40, 40)];
    const ctx = exigir(buildVolumeContext(sets, 'biceps', AHORA));
    expect(ctx.acuteSets).toBe(6);
    expect(ctx.chronicSets).toBe(1.5);
  });
});

describe('applyVolumeContext — solo frena, nunca acelera', () => {
  it('convierte la subida en mantenimiento cuando el volumen está disparado', () => {
    const ctx = buildVolumeContext(
      [
        ...series('pierna', 1, 20),
        ...series('pierna', 9, 8),
        ...series('pierna', 16, 8),
        ...series('pierna', 23, 8),
      ],
      'pierna',
      AHORA,
    );
    const out = exigir(applyVolumeContext(subida, ctx));
    expect(out.action).toBe('hold');
    expect(out.weight).toBe(100);
    expect(out.reps).toBe(8);
    expect(out.deltaPct).toBe(0);
    expect(out.reasonKey).toBe('coach.reason.volume_spike');
  });

  it('no toca una bajada ya decidida por esfuerzo', () => {
    const bajada: LoadSuggestion = { ...subida, action: 'reduce', weight: 95, deltaPct: -5 };
    const ctx = buildVolumeContext(
      [
        ...series('pierna', 1, 20),
        ...series('pierna', 9, 8),
        ...series('pierna', 16, 8),
        ...series('pierna', 23, 8),
      ],
      'pierna',
      AHORA,
    );
    expect(applyVolumeContext(bajada, ctx)).toEqual(bajada);
  });

  it('sin contexto devuelve la sugerencia intacta', () => {
    expect(applyVolumeContext(subida, null)).toEqual(subida);
  });
});
