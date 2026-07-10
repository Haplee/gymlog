import { describe, it, expect } from 'vitest';
import { repsRange } from '../historyHelpers';

describe('repsRange', () => {
  it('devuelve string vacío si array vacío', () => {
    expect(repsRange([])).toBe('');
  });

  it('devuelve un solo número si todos iguales', () => {
    expect(repsRange([10, 10, 10])).toBe('10');
  });

  it('devuelve rango min-max si hay variación', () => {
    expect(repsRange([8, 10, 12])).toBe('8-12');
    expect(repsRange([5, 5, 8])).toBe('5-8');
  });
});
