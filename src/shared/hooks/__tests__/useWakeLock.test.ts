// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { addListenerMock, isNativeMock } = vi.hoisted(() => ({
  addListenerMock: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  isNativeMock: vi.fn(() => false),
}));

vi.mock('@capacitor/app', () => ({ App: { addListener: addListenerMock } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: isNativeMock } }));
vi.mock('@shared/lib/devtools', () => ({ devError: vi.fn() }));

import { useWakeLock, isWakeLockSupported, __resetWakeLockForTests } from '../useWakeLock';

/** Doble de WakeLockSentinel con el `release` observable. */
function makeSentinel() {
  const release = vi.fn(() => Promise.resolve());
  return { release, addEventListener: vi.fn(), removeEventListener: vi.fn() };
}

let requestMock: ReturnType<typeof vi.fn>;
let visibility: DocumentVisibilityState;

beforeEach(() => {
  __resetWakeLockForTests();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
  requestMock = vi.fn(() => Promise.resolve(makeSentinel()));
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    writable: true,
    value: { request: requestMock },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useWakeLock', () => {
  it('pide el bloqueo cuando está habilitado', async () => {
    renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalledWith('screen'));
  });

  it('no pide nada si está deshabilitado', async () => {
    renderHook(() => useWakeLock(false));
    await Promise.resolve();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('suelta el bloqueo al desmontar', async () => {
    const sentinel = makeSentinel();
    requestMock.mockResolvedValue(sentinel);

    const { unmount } = renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalled());

    unmount();
    expect(sentinel.release).toHaveBeenCalled();
  });

  it('vuelve a pedirlo al recuperar visibilidad, que es donde muere una petición única', async () => {
    renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalledTimes(1));

    // El navegador suelta el bloqueo al ocultarse el documento.
    __resetVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    // Oculto no se pide: request() rechazaría.
    expect(requestMock).toHaveBeenCalledTimes(1);

    __resetVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalledTimes(2));
  });

  it('con dos consumidores, solo suelta cuando se va el último', async () => {
    const sentinel = makeSentinel();
    requestMock.mockResolvedValue(sentinel);

    const a = renderHook(() => useWakeLock(true));
    const b = renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalled());

    a.unmount();
    expect(sentinel.release).not.toHaveBeenCalled();

    b.unmount();
    expect(sentinel.release).toHaveBeenCalled();
  });

  it('un rechazo de la API no propaga el error', async () => {
    requestMock.mockRejectedValue(new Error('Low Power Mode'));
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalled());
  });

  it('isWakeLockSupported detecta la ausencia de la API', () => {
    expect(isWakeLockSupported()).toBe(true);
    // @ts-expect-error se borra a propósito para simular un WebView sin soporte
    delete navigator.wakeLock;
    expect(isWakeLockSupported()).toBe(false);
  });
});

/** Cambia el valor que devuelve document.visibilityState. */
function __resetVisibility(v: DocumentVisibilityState) {
  visibility = v;
}
