// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { addListenerMock, isNativeMock } = vi.hoisted(() => ({
  addListenerMock: vi.fn(),
  isNativeMock: vi.fn(() => true),
}));

vi.mock('@capacitor/app', () => ({ App: { addListener: addListenerMock } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: isNativeMock } }));

import { useCapacitorListener } from '../useCapacitorListener';

/** Control manual de cuándo resuelve `addListener`, que es donde vive la carrera. */
function deferredListener() {
  const remove = vi.fn();
  let resolve!: (h: { remove: () => void }) => void;
  const promise = new Promise<{ remove: () => void }>((r) => {
    resolve = r;
  });
  addListenerMock.mockReturnValue(promise);
  return { remove, settle: () => resolve({ remove }) };
}

describe('useCapacitorListener', () => {
  beforeEach(() => {
    addListenerMock.mockReset();
    isNativeMock.mockReturnValue(true);
  });

  /**
   * La regresión que motivó el hook: `addListener` es asíncrono, así que un
   * desmontaje temprano ejecutaba el cleanup con el handle todavía sin asignar
   * y el listener se quedaba vivo. Con la pantalla montándose y desmontándose
   * varias veces, eso acumulaba suscripciones.
   */
  it('retira el listener aunque la suscripción resuelva DESPUÉS del desmontaje', async () => {
    const { remove, settle } = deferredListener();

    const { unmount } = renderHook(() => useCapacitorListener('appStateChange', () => {}));
    unmount();
    settle();
    await Promise.resolve();
    await Promise.resolve();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('retira el listener en el caso normal', async () => {
    const { remove, settle } = deferredListener();

    const { unmount } = renderHook(() => useCapacitorListener('appStateChange', () => {}));
    settle();
    await Promise.resolve();
    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('no se suscribe en web', () => {
    isNativeMock.mockReturnValue(false);

    renderHook(() => useCapacitorListener('appStateChange', () => {}));

    expect(addListenerMock).not.toHaveBeenCalled();
  });

  it('no se suscribe mientras esté deshabilitado', () => {
    renderHook(() => useCapacitorListener('backButton', () => {}, false));

    expect(addListenerMock).not.toHaveBeenCalled();
  });

  it('usa siempre el handler más reciente sin resuscribirse', async () => {
    const { settle } = deferredListener();
    const primero = vi.fn();
    const segundo = vi.fn();

    const { rerender } = renderHook(
      ({ h }: { h: () => void }) => useCapacitorListener('appStateChange', h),
      { initialProps: { h: primero } },
    );
    settle();
    await Promise.resolve();

    rerender({ h: segundo });
    // El plugin invoca al callback registrado en la primera suscripción.
    addListenerMock.mock.calls[0][1]({ isActive: false });

    expect(addListenerMock).toHaveBeenCalledTimes(1);
    expect(primero).not.toHaveBeenCalled();
    expect(segundo).toHaveBeenCalledWith({ isActive: false });
  });
});
