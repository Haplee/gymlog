import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock del builder de supabase: from().select().eq().order() -> Promise<{ data }>.
const orderMock = vi.fn();
vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: orderMock,
        }),
      }),
    }),
  },
}));

import { checkStreakAtRisk } from '../streakChecker';

/** started_at local (mediodía) para una fecha dada, sin sufijo de zona. */
function localNoon(year: number, month1: number, day: number): string {
  const mm = String(month1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}T12:00:00`;
}

describe('checkStreakAtRisk', () => {
  beforeEach(() => {
    orderMock.mockReset();
    vi.useFakeTimers();
    // "Hoy" fijo: 21 jul 2026, mediodía local.
    vi.setSystemTime(new Date(2026, 6, 21, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('false si no hay entrenos', async () => {
    orderMock.mockResolvedValue({ data: [] });
    expect(await checkStreakAtRisk('u1')).toBe(false);
  });

  it('false si data es null', async () => {
    orderMock.mockResolvedValue({ data: null });
    expect(await checkStreakAtRisk('u1')).toBe(false);
  });

  it('false si ya entrenó hoy (aunque venga de una racha larga)', async () => {
    orderMock.mockResolvedValue({
      data: [
        { started_at: localNoon(2026, 7, 21) }, // hoy
        { started_at: localNoon(2026, 7, 20) },
        { started_at: localNoon(2026, 7, 19) },
        { started_at: localNoon(2026, 7, 18) },
      ],
    });
    expect(await checkStreakAtRisk('u1')).toBe(false);
  });

  it('true si tiene racha >= 3 hasta ayer y no ha entrenado hoy', async () => {
    orderMock.mockResolvedValue({
      data: [
        { started_at: localNoon(2026, 7, 20) }, // ayer
        { started_at: localNoon(2026, 7, 19) },
        { started_at: localNoon(2026, 7, 18) },
      ],
    });
    expect(await checkStreakAtRisk('u1')).toBe(true);
  });

  it('false si la racha hasta ayer es < 3', async () => {
    orderMock.mockResolvedValue({
      data: [
        { started_at: localNoon(2026, 7, 20) }, // ayer
        { started_at: localNoon(2026, 7, 19) },
      ],
    });
    expect(await checkStreakAtRisk('u1')).toBe(false);
  });

  it('false si no entrenó ayer (racha rota, aunque haya entrenos antiguos)', async () => {
    orderMock.mockResolvedValue({
      data: [
        { started_at: localNoon(2026, 7, 18) },
        { started_at: localNoon(2026, 7, 17) },
        { started_at: localNoon(2026, 7, 16) },
      ],
    });
    expect(await checkStreakAtRisk('u1')).toBe(false);
  });

  it('ignora started_at inválidos o nulos sin romper', async () => {
    orderMock.mockResolvedValue({
      data: [
        { started_at: null },
        { started_at: 'no-es-fecha' },
        { started_at: localNoon(2026, 7, 20) },
        { started_at: localNoon(2026, 7, 19) },
        { started_at: localNoon(2026, 7, 18) },
      ],
    });
    expect(await checkStreakAtRisk('u1')).toBe(true);
  });
});
