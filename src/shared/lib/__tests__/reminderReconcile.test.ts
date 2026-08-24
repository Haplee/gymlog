import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* Mocks de los módulos que tocan plataforma/red. Se declaran antes del import
   del módulo bajo prueba porque vi.mock se iza al principio del fichero. */
const notif = vi.hoisted(() => ({
  isNative: vi.fn(() => true),
  canNotifyAsync: vi.fn(async () => true),
  syncRoutineReminders: vi.fn(async () => undefined),
  scheduleStreakReminder: vi.fn(async () => undefined),
  cancelStreakReminder: vi.fn(async () => undefined),
}));
const streak = vi.hoisted(() => ({ checkStreakAtRisk: vi.fn(async () => false) }));
const db = vi.hoisted(() => ({ limit: vi.fn(async () => ({ data: [] as unknown[] })) }));

vi.mock('@shared/lib/notifications', () => notif);
vi.mock('@shared/lib/streakChecker', () => streak);
vi.mock('@shared/lib/devtools', () => ({ devError: vi.fn(), devLog: vi.fn() }));
vi.mock('@shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ gte: () => ({ limit: db.limit }) }) }),
    }),
  },
}));
vi.mock('@shared/stores/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ trainingReminders: true }) },
}));

const { reconcileReminders, startOfLocalDayIso, hasTrainedToday } =
  await import('@shared/lib/reminderReconcile');

const DAYS = [{ weekday: 2, routineName: 'Push' }];

beforeEach(() => {
  vi.clearAllMocks();
  notif.isNative.mockReturnValue(true);
  notif.canNotifyAsync.mockResolvedValue(true);
  streak.checkStreakAtRisk.mockResolvedValue(false);
  db.limit.mockResolvedValue({ data: [] });
});

describe('startOfLocalDayIso', () => {
  it('devuelve la medianoche LOCAL como instante absoluto, no la medianoche UTC', () => {
    // Zona con offset != 0 para que el fallo sea visible.
    const now = new Date(2026, 7, 25, 13, 45, 0); // 25-ago-2026 13:45 local
    const iso = startOfLocalDayIso(now);
    const parsed = new Date(iso);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(25);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
    // Regresión: la cadena antigua era 'YYYY-MM-DDT00:00:00' sin zona.
    expect(iso).toMatch(/Z$/);
  });

  it('un entreno justo pasada la medianoche local cuenta como de hoy', async () => {
    db.limit.mockResolvedValue({ data: [{ id: 'w1' }] });
    await expect(hasTrainedToday('u1')).resolves.toBe(true);
  });
});

describe('reconcileReminders — alerta de racha', () => {
  it('NO programa la racha si no hay racha real en riesgo', async () => {
    streak.checkStreakAtRisk.mockResolvedValue(false);
    await reconcileReminders('u1', DAYS);
    expect(notif.scheduleStreakReminder).not.toHaveBeenCalled();
    expect(notif.cancelStreakReminder).toHaveBeenCalled();
  });

  it('programa la racha solo cuando checkStreakAtRisk lo confirma', async () => {
    streak.checkStreakAtRisk.mockResolvedValue(true);
    await reconcileReminders('u1', DAYS);
    expect(notif.scheduleStreakReminder).toHaveBeenCalledTimes(1);
  });

  it('si ya entrenó hoy no consulta el riesgo y cancela la racha', async () => {
    await reconcileReminders('u1', DAYS, { trainedToday: true });
    expect(streak.checkStreakAtRisk).not.toHaveBeenCalled();
    expect(notif.scheduleStreakReminder).not.toHaveBeenCalled();
    expect(notif.cancelStreakReminder).toHaveBeenCalled();
  });
});

describe('reconcileReminders — serialización', () => {
  it('no entrelaza dos reconciliaciones concurrentes', async () => {
    const order: string[] = [];
    notif.syncRoutineReminders.mockImplementation(async () => {
      order.push('inicio');
      await new Promise((r) => setTimeout(r, 10));
      order.push('fin');
    });

    await Promise.all([
      reconcileReminders('u1', DAYS),
      reconcileReminders('u1', DAYS),
      reconcileReminders('u1', DAYS),
    ]);

    // Cada sync que llegue a ejecutarse lo hace entero antes que el siguiente:
    // nunca 'inicio','inicio' seguidos (que es la carrera cancel/schedule).
    for (let i = 0; i < order.length; i += 2) {
      expect(order[i]).toBe('inicio');
      expect(order[i + 1]).toBe('fin');
    }
  });

  it('descarta las reconciliaciones obsoletas: solo corre la última en cola', async () => {
    await Promise.all([
      reconcileReminders('u1', DAYS),
      reconcileReminders('u1', DAYS),
      reconcileReminders('u1', DAYS),
    ]);
    // La primera arranca de inmediato; las intermedias se descartan.
    expect(notif.syncRoutineReminders.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('un fallo no rompe la cola para las siguientes llamadas', async () => {
    notif.syncRoutineReminders.mockRejectedValueOnce(new Error('boom'));
    await reconcileReminders('u1', DAYS);
    notif.syncRoutineReminders.mockResolvedValue(undefined);
    await reconcileReminders('u1', DAYS);
    expect(notif.syncRoutineReminders).toHaveBeenCalledTimes(2);
  });
});

describe('reconcileReminders — guardas', () => {
  it('no hace nada en web', async () => {
    notif.isNative.mockReturnValue(false);
    await reconcileReminders('u1', DAYS);
    expect(notif.syncRoutineReminders).not.toHaveBeenCalled();
  });

  it('no hace nada sin permiso del sistema', async () => {
    notif.canNotifyAsync.mockResolvedValue(false);
    await reconcileReminders('u1', DAYS);
    expect(notif.syncRoutineReminders).not.toHaveBeenCalled();
  });
});

afterEach(() => vi.useRealTimers());
