// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const removeListener = vi.fn<() => Promise<void>>();
  const addListener =
    vi.fn<
      (eventName: string, listener: () => void) => Promise<{ remove: typeof removeListener }>
    >();

  return {
    isNativePlatform: vi.fn<() => boolean>(),
    toggleBackButtonHandler: vi.fn<(options: { enabled: boolean }) => Promise<void>>(),
    addListener,
    removeListener,
  };
});

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: mocks.addListener,
    toggleBackButtonHandler: mocks.toggleBackButtonHandler,
  },
}));

let backListener: (() => void) | undefined;

async function loadBackHandler() {
  vi.resetModules();
  return import('../backHandler');
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.clearAllMocks();
  backListener = undefined;
  mocks.isNativePlatform.mockReturnValue(true);
  mocks.toggleBackButtonHandler.mockResolvedValue(undefined);
  mocks.addListener.mockImplementation(async (_eventName, listener) => {
    backListener = listener;
    return { remove: mocks.removeListener };
  });
  window.history.replaceState({ idx: 0 }, '');
  vi.spyOn(window.history, 'back').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '');
});

describe('backHandler', () => {
  it('no registra el listener nativo fuera de Android', async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    const { initPredictiveBack } = await loadBackHandler();

    const dispose = initPredictiveBack();

    expect(mocks.addListener).not.toHaveBeenCalled();
    expect(mocks.toggleBackButtonHandler).not.toHaveBeenCalled();
    expect(() => dispose()).not.toThrow();
  });

  it('registra y elimina el listener nativo', async () => {
    const { initPredictiveBack } = await loadBackHandler();

    const dispose = initPredictiveBack();
    await flushPromises();

    expect(mocks.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));

    dispose();
    await flushPromises();

    expect(mocks.removeListener).toHaveBeenCalledOnce();
  });

  it('da prioridad al overlay más reciente', async () => {
    const { initPredictiveBack, registerBackAction } = await loadBackHandler();
    const first = vi.fn();
    const second = vi.fn();
    const dispose = initPredictiveBack();
    await flushPromises();

    const disposeFirst = registerBackAction('first', first);
    const disposeSecond = registerBackAction('second', second);
    backListener?.();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();

    disposeFirst();
    disposeSecond();
    dispose();
  });

  it('elimina un overlay y desactiva el handler nativo al quedar vacío', async () => {
    const { initPredictiveBack, registerBackAction } = await loadBackHandler();
    const action = vi.fn();
    const dispose = initPredictiveBack();
    await flushPromises();

    expect(mocks.toggleBackButtonHandler).toHaveBeenLastCalledWith({ enabled: false });

    const disposeOverlay = registerBackAction('overlay', action);
    expect(mocks.toggleBackButtonHandler).toHaveBeenLastCalledWith({ enabled: true });

    disposeOverlay();
    expect(mocks.toggleBackButtonHandler).toHaveBeenLastCalledWith({ enabled: false });

    dispose();
  });

  it('navega por el historial cuando no hay overlays', async () => {
    window.history.replaceState({ idx: 2 }, '');
    const { initPredictiveBack } = await loadBackHandler();
    const dispose = initPredictiveBack();
    await flushPromises();

    backListener?.();

    expect(window.history.back).toHaveBeenCalledOnce();

    dispose();
  });

  it('mantiene el handler sincronizado con los cambios de historial', async () => {
    const { initPredictiveBack, syncBackState } = await loadBackHandler();
    const dispose = initPredictiveBack();
    await flushPromises();

    expect(mocks.toggleBackButtonHandler).toHaveBeenLastCalledWith({ enabled: false });

    window.history.replaceState({ idx: 1 }, '');
    syncBackState();
    expect(mocks.toggleBackButtonHandler).toHaveBeenLastCalledWith({ enabled: true });

    window.history.replaceState({ idx: 0 }, '');
    syncBackState();
    expect(mocks.toggleBackButtonHandler).toHaveBeenLastCalledWith({ enabled: false });

    dispose();
  });

  it('deja el handler activo si la plataforma rechaza desactivarlo', async () => {
    mocks.toggleBackButtonHandler.mockRejectedValueOnce(new Error('fallo nativo'));
    const { initPredictiveBack, registerBackAction } = await loadBackHandler();
    const action = vi.fn();
    const dispose = initPredictiveBack();
    await flushPromises();

    expect(mocks.toggleBackButtonHandler).toHaveBeenCalledWith({ enabled: false });

    const disposeOverlay = registerBackAction('overlay', action);
    backListener?.();

    expect(action).toHaveBeenCalledOnce();

    disposeOverlay();
    expect(mocks.toggleBackButtonHandler).toHaveBeenCalledTimes(2);
    expect(mocks.toggleBackButtonHandler).toHaveBeenLastCalledWith({ enabled: false });

    dispose();
  });

  it('ignora un estado de historial sin índice numérico', async () => {
    window.history.replaceState({ idx: '2' }, '');
    const { initPredictiveBack } = await loadBackHandler();
    const dispose = initPredictiveBack();
    await flushPromises();

    backListener?.();

    expect(window.history.back).not.toHaveBeenCalled();
    expect(mocks.toggleBackButtonHandler).toHaveBeenLastCalledWith({ enabled: false });

    dispose();
  });
});
