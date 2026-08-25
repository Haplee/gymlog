// @vitest-environment jsdom
// El store persiste en localStorage; sin DOM el middleware `persist` ni carga.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useWorkTimerStore } from '../workTimerStore';

describe('workTimerStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T10:00:00.000Z'));
    useWorkTimerStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('empieza en cero y parado', () => {
    const s = useWorkTimerStore.getState();
    expect(s.isRunning).toBe(false);
    expect(s.elapsedSeconds()).toBe(0);
  });

  it('cuenta hacia arriba, no hacia abajo', () => {
    useWorkTimerStore.getState().start();
    vi.advanceTimersByTime(45_000);
    expect(useWorkTimerStore.getState().elapsedSeconds()).toBe(45);
  });

  it('el tiempo sale del reloj, no de un contador: un salto de 30 s se cuenta entero', () => {
    // Es lo que pasa cuando el WebView de Android congela los intervalos con la
    // app en segundo plano. Un contador incremental habría perdido esos 30 s.
    useWorkTimerStore.getState().start();
    vi.advanceTimersByTime(30_000);
    expect(useWorkTimerStore.getState().elapsedSeconds()).toBe(30);
  });

  it('pausar conserva lo contado y detiene el avance', () => {
    const store = useWorkTimerStore.getState();
    store.start();
    vi.advanceTimersByTime(20_000);
    useWorkTimerStore.getState().pause();

    expect(useWorkTimerStore.getState().elapsedSeconds()).toBe(20);
    vi.advanceTimersByTime(60_000);
    expect(useWorkTimerStore.getState().elapsedSeconds()).toBe(20);
  });

  it('reanudar suma sobre lo acumulado', () => {
    useWorkTimerStore.getState().start();
    vi.advanceTimersByTime(20_000);
    useWorkTimerStore.getState().pause();
    vi.advanceTimersByTime(60_000);
    useWorkTimerStore.getState().resume();
    vi.advanceTimersByTime(10_000);

    expect(useWorkTimerStore.getState().elapsedSeconds()).toBe(30);
  });

  it('pausar dos veces seguidas no descuenta ni duplica', () => {
    useWorkTimerStore.getState().start();
    vi.advanceTimersByTime(15_000);
    useWorkTimerStore.getState().pause();
    useWorkTimerStore.getState().pause();

    expect(useWorkTimerStore.getState().elapsedSeconds()).toBe(15);
  });

  it('reanudar mientras ya corre no reinicia el tramo', () => {
    useWorkTimerStore.getState().start();
    vi.advanceTimersByTime(15_000);
    useWorkTimerStore.getState().resume();
    vi.advanceTimersByTime(5_000);

    expect(useWorkTimerStore.getState().elapsedSeconds()).toBe(20);
  });

  it('start descarta lo anterior en vez de sumar', () => {
    useWorkTimerStore.getState().start();
    vi.advanceTimersByTime(40_000);
    useWorkTimerStore.getState().start();
    vi.advanceTimersByTime(5_000);

    expect(useWorkTimerStore.getState().elapsedSeconds()).toBe(5);
  });

  it('reset vuelve a cero', () => {
    useWorkTimerStore.getState().start();
    vi.advanceTimersByTime(40_000);
    useWorkTimerStore.getState().reset();

    expect(useWorkTimerStore.getState().elapsedSeconds()).toBe(0);
    expect(useWorkTimerStore.getState().isRunning).toBe(false);
  });

  it('los segundos se truncan: 44,9 s son 44', () => {
    useWorkTimerStore.getState().start();
    vi.advanceTimersByTime(44_900);
    expect(useWorkTimerStore.getState().elapsedSeconds()).toBe(44);
  });
});
