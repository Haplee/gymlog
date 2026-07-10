import { describe, it, expect } from 'vitest';
import { formatDuration } from '../duration';

describe('formatDuration', () => {
  it('formatea segundos por debajo de una hora como "Nmin"', () => {
    expect(formatDuration(0)).toBe('0min');
    expect(formatDuration(45)).toBe('0min');
    expect(formatDuration(60)).toBe('1min');
    expect(formatDuration(1800)).toBe('30min');
  });

  it('formatea una hora o más como "Xh Ym"', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(5400)).toBe('1h 30m');
    expect(formatDuration(7325)).toBe('2h 2m');
  });
});
