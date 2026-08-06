// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { resolveTheme } from '@shared/stores/settingsStore';
import { getSystemDark, onSystemDarkChange } from '../systemTheme';

type MqListener = (e: { matches: boolean }) => void;

/** Stub mínimo de MediaQueryList para el path web (matchMedia). */
function mockMatchMedia(dark: boolean) {
  const listeners = new Set<MqListener>();
  const mq = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: MqListener) => listeners.add(cb),
    removeEventListener: (_: string, cb: MqListener) => listeners.delete(cb),
    dispatchEvent: (_: Event) => true,
    /** Emula el evento `change` de la media query. */
    emitChange(matches: boolean) {
      mq.matches = matches;
      listeners.forEach((cb) => cb({ matches }));
    },
  };
  const getter = vi.fn(() => mq);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: getter,
  });
  return mq;
}

describe('resolveTheme (tema efectivo)', () => {
  it('devuelve el tema elegido tal cual para dark/light', () => {
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
  });

  it('resuelve «system» contra el modo oscuro del sistema', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('getSystemDark (web)', () => {
  beforeEach(() => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lee prefers-color-scheme cuando la plataforma no es nativa', async () => {
    mockMatchMedia(true);
    await expect(getSystemDark()).resolves.toBe(true);

    mockMatchMedia(false);
    await expect(getSystemDark()).resolves.toBe(false);
  });
});

describe('onSystemDarkChange', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('escucha cambios de prefers-color-scheme en web y se puede cancelar', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    const mq = mockMatchMedia(false);

    const onDark = vi.fn();
    const unsubscribe = onSystemDarkChange(onDark);

    mq.emitChange(true);
    expect(onDark).toHaveBeenCalledWith(true);

    unsubscribe();
    mq.emitChange(false);
    expect(onDark).toHaveBeenCalledTimes(1);
  });

  it('escucha el evento nativo systemThemeChanged y se puede cancelar', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

    const onDark = vi.fn();
    const unsubscribe = onSystemDarkChange(onDark);

    window.dispatchEvent(new CustomEvent('systemThemeChanged', { detail: { dark: true } }));
    expect(onDark).toHaveBeenCalledWith(true);

    // Eventos sin el detalle esperado se ignoran
    window.dispatchEvent(new CustomEvent('systemThemeChanged', { detail: {} }));
    window.dispatchEvent(new CustomEvent('systemThemeChanged'));
    expect(onDark).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(new CustomEvent('systemThemeChanged', { detail: { dark: false } }));
    expect(onDark).toHaveBeenCalledTimes(1);
  });
});
