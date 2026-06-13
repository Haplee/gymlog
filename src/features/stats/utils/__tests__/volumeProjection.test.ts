import { describe, it, expect } from 'vitest';
import { projectNextVolume } from '../volumeProjection';

describe('projectNextVolume', () => {
  it('devuelve null con menos de 2 puntos', () => {
    expect(projectNextVolume([])).toBeNull();
    expect(projectNextVolume([100])).toBeNull();
  });

  it('proyecta tendencia ascendente lineal', () => {
    const r = projectNextVolume([100, 200, 300, 400]);
    if (!r) throw new Error('esperaba proyección');
    expect(r.slope).toBeCloseTo(100, 5);
    expect(r.projected).toBe(500);
    expect(r.trend).toBe('up');
  });

  it('detecta tendencia descendente', () => {
    const r = projectNextVolume([400, 300, 200, 100]);
    if (!r) throw new Error('esperaba proyección');
    expect(r.trend).toBe('down');
    expect(r.projected).toBe(0); // clamp a 0 (sería negativo)
  });

  it('marca plano si la pendiente es despreciable', () => {
    const r = projectNextVolume([1000, 1005, 998, 1002]);
    if (!r) throw new Error('esperaba proyección');
    expect(r.trend).toBe('flat');
  });
});
