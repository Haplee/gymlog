// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn<() => boolean>(),
  impact: vi.fn<(options: { style: string }) => Promise<void>>(),
  notification: vi.fn<(options: { type: string }) => Promise<void>>(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: mocks.impact, notification: mocks.notification },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
  NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
}));

async function loadHaptics() {
  vi.resetModules();
  return import('../haptics');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.impact.mockResolvedValue(undefined);
  mocks.notification.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('haptics', () => {
  it('usa los patrones nativos diferenciados para cada evento de entrenamiento', async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    const { completeSet, newPR, startTimer, tapSet, timerDone } = await loadHaptics();

    await tapSet();
    await completeSet();
    await startTimer();
    await timerDone();
    await newPR();

    expect(mocks.impact.mock.calls).toEqual([
      [{ style: 'LIGHT' }],
      [{ style: 'MEDIUM' }],
      [{ style: 'HEAVY' }],
    ]);
    expect(mocks.notification.mock.calls).toEqual([[{ type: 'WARNING' }], [{ type: 'SUCCESS' }]]);
  });

  it('usa navigator.vibrate en web con patrones equivalentes', async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrate,
    });
    const { newPR, tapSet, timerDone } = await loadHaptics();

    await tapSet();
    await timerDone();
    await newPR();

    expect(vibrate.mock.calls).toEqual([[8], [[30, 40, 30]], [[15, 40, 30]]]);
    expect(mocks.impact).not.toHaveBeenCalled();
    expect(mocks.notification).not.toHaveBeenCalled();
  });

  it('recurre a la vibración web si Capacitor rechaza la llamada', async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.impact.mockRejectedValueOnce(new Error('Haptics no disponible'));
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrate,
    });
    const { tapSet } = await loadHaptics();

    await expect(tapSet()).resolves.toBeUndefined();
    expect(vibrate).toHaveBeenCalledWith(8);
  });
});
