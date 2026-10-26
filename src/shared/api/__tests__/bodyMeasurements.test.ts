import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const llamadas = {
    upsert: [] as {
      payload: Record<string, unknown>;
      options: Record<string, unknown> | undefined;
    }[],
  };

  const single = async () => ({
    data: {
      id: 'm-1',
      user_id: 'u1',
      date: '2026-01-05',
      weight_kg: null,
      body_fat_pct: null,
      muscle_mass_kg: null,
      notes: null,
      created_at: null,
    },
    error: null,
  });

  const builder = {
    upsert: (payload: Record<string, unknown>, options?: Record<string, unknown>) => {
      llamadas.upsert.push({ payload, options });
      return builder;
    },
    insert: (payload: Record<string, unknown>) => {
      llamadas.upsert.push({ payload, options: undefined });
      return builder;
    },
    select: () => builder,
    single,
  };

  return {
    llamadas,
    from: () => builder,
    toLocalDateKey: vi.fn((_d: Date) => '2026-01-05'),
  };
});

vi.mock('@shared/lib/supabase', () => ({ supabase: { from: h.from } }));
vi.mock('@shared/lib/dateKeys', () => ({ toLocalDateKey: h.toLocalDateKey }));

import { addBodyMeasurement } from '../queries';

describe('addBodyMeasurement', () => {
  beforeEach(() => {
    h.llamadas.upsert.length = 0;
    h.toLocalDateKey.mockClear();
  });

  it('hace upsert por (user_id, date) con la fecha local', async () => {
    await addBodyMeasurement('u1', { weight_kg: 80.5, body_fat_pct: 15 });

    expect(h.llamadas.upsert).toHaveLength(1);
    const { payload, options } = h.llamadas.upsert[0];
    expect(options).toEqual({ onConflict: 'user_id,date' });
    expect(payload).toEqual({
      user_id: 'u1',
      date: '2026-01-05',
      weight_kg: 80.5,
      body_fat_pct: 15,
    });
    // La fecha sale de la utilidad local, no de `toISOString()`.
    expect(h.toLocalDateKey).toHaveBeenCalledTimes(1);
    expect(h.toLocalDateKey.mock.calls[0][0]).toBeInstanceOf(Date);
  });

  it('solo manda los campos escritos: la grasa no borra el peso del día', async () => {
    await addBodyMeasurement('u1', { weight_kg: null, body_fat_pct: 14.2 });

    const { payload } = h.llamadas.upsert[0];
    expect(payload).toMatchObject({ user_id: 'u1', date: '2026-01-05', body_fat_pct: 14.2 });
    expect(payload).not.toHaveProperty('weight_kg');
  });

  it('solo manda los campos escritos: el peso no borra la grasa del día', async () => {
    await addBodyMeasurement('u1', { weight_kg: 79, body_fat_pct: null });

    const { payload } = h.llamadas.upsert[0];
    expect(payload).toMatchObject({ user_id: 'u1', date: '2026-01-05', weight_kg: 79 });
    expect(payload).not.toHaveProperty('body_fat_pct');
  });
});
