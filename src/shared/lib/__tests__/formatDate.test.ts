import { describe, it, expect } from 'vitest';
import { formatDisplayDate } from '../formatDate';

describe('formatDisplayDate', () => {
  it('acepta un objeto Date', () => {
    const d = new Date(2026, 6, 10); // 10 julio 2026 (local)
    expect(formatDisplayDate(d)).toBe(d.toLocaleDateString('es'));
  });

  it('acepta una cadena ISO', () => {
    const iso = '2026-07-10T08:30:00.000Z';
    expect(formatDisplayDate(iso)).toBe(new Date(iso).toLocaleDateString('es'));
  });
});
