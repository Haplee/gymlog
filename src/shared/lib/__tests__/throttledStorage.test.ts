// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Capacitor: web (isNativePlatform false) para no tocar el plugin de App.
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));
vi.mock('@capacitor/app', () => ({
  App: { addListener: vi.fn() },
}));

import { createThrottledLocalStorage, flushThrottledStorage } from '../throttledStorage';

describe('createThrottledLocalStorage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    flushThrottledStorage();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('no escribe en disco antes de que venza la ventana', () => {
    const storage = createThrottledLocalStorage(600);
    storage.setItem('k', 'v1');

    expect(localStorage.getItem('k')).toBeNull();

    vi.advanceTimersByTime(600);
    expect(localStorage.getItem('k')).toBe('v1');
  });

  it('agrupa escrituras seguidas en una sola: solo sobrevive la última', () => {
    const storage = createThrottledLocalStorage(600);
    const spy = vi.spyOn(Storage.prototype, 'setItem');

    storage.setItem('k', 'a');
    storage.setItem('k', 'b');
    storage.setItem('k', 'c');
    vi.advanceTimersByTime(600);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('k')).toBe('c');
    spy.mockRestore();
  });

  it('es throttle y no debounce: escribir sin parar no aplaza el volcado', () => {
    const storage = createThrottledLocalStorage(600);

    storage.setItem('k', 'a');
    vi.advanceTimersByTime(500);
    storage.setItem('k', 'b'); // dentro de la ventana ya abierta
    vi.advanceTimersByTime(100);

    // El plazo lo fijó la primera escritura, así que ya está en disco.
    expect(localStorage.getItem('k')).toBe('b');
  });

  it('getItem lee del búfer antes que del disco', () => {
    const storage = createThrottledLocalStorage(600);
    localStorage.setItem('k', 'viejo');

    storage.setItem('k', 'nuevo');
    expect(storage.getItem('k')).toBe('nuevo');
    expect(localStorage.getItem('k')).toBe('viejo');
  });

  it('removeItem borra en el acto y descarta lo pendiente', () => {
    const storage = createThrottledLocalStorage(600);
    localStorage.setItem('k', 'viejo');

    storage.setItem('k', 'pendiente');
    storage.removeItem('k');
    vi.advanceTimersByTime(600);

    expect(localStorage.getItem('k')).toBeNull();
    expect(storage.getItem('k')).toBeNull();
  });

  it('vuelca al pasar a segundo plano sin esperar la ventana', () => {
    const storage = createThrottledLocalStorage(600);
    storage.setItem('k', 'v');

    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(localStorage.getItem('k')).toBe('v');
  });

  it('un volcado cubre las claves de todos los stores', () => {
    const a = createThrottledLocalStorage(600);
    const b = createThrottledLocalStorage(600);

    a.setItem('store-a', '1');
    b.setItem('store-b', '2');
    flushThrottledStorage();

    expect(localStorage.getItem('store-a')).toBe('1');
    expect(localStorage.getItem('store-b')).toBe('2');
  });

  it('una escritura que falla no impide las demás', () => {
    const storage = createThrottledLocalStorage(600);
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError');
      })
      .mockImplementation(function (this: Storage, k: string, v: string) {
        Object.defineProperty(this, k, { value: v, configurable: true, enumerable: true });
      });

    storage.setItem('falla', 'x');
    storage.setItem('pasa', 'y');
    expect(() => flushThrottledStorage()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(2);

    spy.mockRestore();
  });
});
