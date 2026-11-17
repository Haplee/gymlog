import { describe, it, expect } from 'vitest';
import { calculateFatiguePenalty, MAX_FATIGUE_PENALTY } from './fatigueCalculator';

describe('fatigueCalculator', () => {
  it('0→0', () => expect(calculateFatiguePenalty(0)).toBe(0));
  it('2→0', () => expect(calculateFatiguePenalty(2)).toBe(0));
  it('3→0.025', () => expect(calculateFatiguePenalty(3)).toBe(0.025));
  it('4→0.05', () => expect(calculateFatiguePenalty(4)).toBe(0.05));
  it('5→0.075', () => expect(calculateFatiguePenalty(5)).toBe(0.075));
  it('6→0.10', () => expect(calculateFatiguePenalty(6)).toBe(0.1));
  it('10→cap', () => expect(calculateFatiguePenalty(10)).toBe(MAX_FATIGUE_PENALTY));
  it('sessionCount<3→0', () => expect(calculateFatiguePenalty(5, 1)).toBe(0));
  it('sessionCount=3→normal', () => expect(calculateFatiguePenalty(5, 3)).toBe(0.075));
  it('floor 3dec', () => expect(String(calculateFatiguePenalty(3))).toMatch(/^0\.025$/));
});
