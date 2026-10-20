// @vitest-environment jsdom
/**
 * Cableado de `useBackgroundNotifications`: el que hace que las alarmas no se
 * queden horneadas con el estado de ayer.
 *
 * La causa raíz del bug de notificaciones era que el estado se leía una sola
 * vez al montar: cruzar la medianoche con la app abierta no emite ningún
 * evento de Capacitor, así que «¿he entrenado hoy?», el plan de la semana y el
 * día que le toca a la rutina caducaban hasta la próxima apertura (que puede
 * no llegar antes de que suene la alarma). Estos tests cubren ese timer, la
 * reconciliación al volver a primer plano y la limpieza al desmontar.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mocks = vi.hoisted(() => {
  const single = vi.fn(async () => ({ data: { notifications_enabled: true } }));
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const setNotificationsEnabled = vi.fn();
  return {
    from,
    single,
    reconcileReminders: vi.fn(async () => undefined),
    checkWeeklySummary: vi.fn(async () => undefined),
    checkStreakAtRisk: vi.fn(async () => false),
    scheduleWeeklySummaryReminder: vi.fn(async () => undefined),
    canNotifyAsync: vi.fn(async () => true),
    registerPushNotifications: vi.fn(async () => undefined),
    isNative: vi.fn(() => true),
    setNotificationsEnabled,
    reminderTimes: { streak: { hour: 20, minute: 0 } },
  };
});

const appListener = vi.hoisted(() => ({ addListener: vi.fn() }));

vi.mock('@capacitor/app', () => ({ App: { addListener: appListener.addListener } }));
vi.mock('@shared/lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('@shared/lib/streakChecker', () => ({ checkStreakAtRisk: mocks.checkStreakAtRisk }));
vi.mock('@shared/lib/weeklySummary', () => ({ checkWeeklySummary: mocks.checkWeeklySummary }));
vi.mock('@shared/lib/reminderReconcile', () => ({ reconcileReminders: mocks.reconcileReminders }));
vi.mock('@shared/lib/devtools', () => ({ devError: vi.fn(), devLog: vi.fn() }));
vi.mock('@shared/lib/push', () => ({
  registerPushNotifications: mocks.registerPushNotifications,
}));
vi.mock('@shared/lib/notifications', () => ({
  isNative: mocks.isNative,
  scheduleWeeklySummaryReminder: mocks.scheduleWeeklySummaryReminder,
  canNotifyAsync: mocks.canNotifyAsync,
  notify: vi.fn(),
  getStreakReminderCopy: () => ({ title: 'Racha', body: 'Te la juegas' }),
}));
vi.mock('@shared/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      setNotificationsEnabled: mocks.setNotificationsEnabled,
      reminderTimes: mocks.reminderTimes,
    }),
  },
}));

import { useBackgroundNotifications } from '../useBackgroundNotifications';

const DIAS = [{ weekday: 2, routineName: 'Push' }];
const getDays = () => DIAS;

/** Drena las cadenas de `await` del montaje (supabase + checks en paralelo). */
async function flush(times = 6) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('useBackgroundNotifications', () => {
  let removeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    removeMock = vi.fn();
    mocks.isNative.mockReturnValue(true);
    mocks.canNotifyAsync.mockResolvedValue(true);
    mocks.single.mockResolvedValue({ data: { notifications_enabled: true } });
    appListener.addListener.mockResolvedValue({ remove: removeMock });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sin usuario no hace nada', async () => {
    renderHook(() => useBackgroundNotifications(null, getDays));
    await flush();

    expect(mocks.reconcileReminders).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('al montar reprograma las alarmas nativas y registra el flag de la DB', async () => {
    renderHook(() => useBackgroundNotifications('u1', getDays));
    await flush();

    // Sincroniza el toggle multi-dispositivo…
    expect(mocks.setNotificationsEnabled).toHaveBeenCalledWith(true);
    // …y reprograma las alarmas persistidas + push en cada arranque.
    expect(mocks.reconcileReminders).toHaveBeenCalledWith('u1', DIAS);
    expect(mocks.scheduleWeeklySummaryReminder).toHaveBeenCalled();
    expect(mocks.registerPushNotifications).toHaveBeenCalledWith('u1');
  });

  it('reconcilia de nuevo al volver a primer plano', async () => {
    renderHook(() => useBackgroundNotifications('u1', getDays));
    await flush();
    const before = mocks.reconcileReminders.mock.calls.length;

    // El listener de appStateChange (nativo) recibe isActive al reanudar.
    const handler = appListener.addListener.mock.calls[0][1] as (e: { isActive: boolean }) => void;
    await act(async () => {
      handler({ isActive: true });
      await Promise.resolve();
    });

    expect(mocks.reconcileReminders.mock.calls.length).toBeGreaterThan(before);
  });

  it('re-ejecuta los checks al cruzar la medianoche (re-hornea las alarmas)', async () => {
    vi.useFakeTimers();
    renderHook(() => useBackgroundNotifications('u1', getDays));
    await flush();
    const before = mocks.reconcileReminders.mock.calls.length;

    // Avanza hasta mañana 00:00:02, donde está programado el timer.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25 * 60 * 60 * 1000);
    });

    expect(mocks.reconcileReminders.mock.calls.length).toBeGreaterThan(before);
  });

  it('al desmontar limpia el timer de medianoche', async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useBackgroundNotifications('u1', getDays));
    await flush();
    const before = mocks.reconcileReminders.mock.calls.length;

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25 * 60 * 60 * 1000);
    });

    // Tras desmontar, cruzar la medianoche no debe volver a disparar nada.
    expect(mocks.reconcileReminders.mock.calls.length).toBe(before);
    expect(removeMock).toHaveBeenCalled();
  });

  it('en web (sin nativo) no se suscribe al listener de la app', async () => {
    mocks.isNative.mockReturnValue(false);
    mocks.canNotifyAsync.mockResolvedValue(false);

    renderHook(() => useBackgroundNotifications('u1', getDays));
    await flush();

    expect(appListener.addListener).not.toHaveBeenCalled();
    expect(mocks.registerPushNotifications).not.toHaveBeenCalled();
  });
});
