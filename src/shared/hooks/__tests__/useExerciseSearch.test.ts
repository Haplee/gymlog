// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@shared/api/queries', () => ({ fetchExercises: vi.fn(async () => []) }));
// El hook solo usa `useQuery` para traer el catálogo; aquí no interesa la red,
// interesa la máquina de foco.
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false }),
}));

import { useExerciseSearch } from '../useExerciseSearch';

describe('useExerciseSearch — foco del desplegable', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => renderHook(() => useExerciseSearch({ userId: 'u1', debounceMs: 250 }));

  it('cierra el desplegable 200 ms después de perder el foco', () => {
    const { result } = setup();

    act(() => result.current.onFocus());
    expect(result.current.isFocused).toBe(true);

    act(() => result.current.onBlur());
    // Todavía abierto: la espera existe para que dé tiempo a pulsar un resultado.
    expect(result.current.isFocused).toBe(true);

    act(() => void vi.advanceTimersByTime(200));
    expect(result.current.isFocused).toBe(false);
  });

  it('NO se cierra si el foco vuelve antes de que venza la espera', () => {
    const { result } = setup();

    act(() => result.current.onFocus());
    act(() => result.current.onBlur());

    // El usuario vuelve al campo enseguida: tocar la X de limpiar, o volver a
    // tocar el propio input tras un roce fuera.
    act(() => void vi.advanceTimersByTime(100));
    act(() => result.current.onFocus());
    expect(result.current.isFocused).toBe(true);

    // Aquí vencía el temporizador del blur anterior, que nadie había cancelado:
    // apagaba el foco con el campo enfocado y el desplegable desaparecía. El
    // buscador quedaba escribible pero mudo — sin resultados y sin manera de
    // recuperarlos salvo volver a tocar fuera y dentro.
    act(() => void vi.advanceTimersByTime(150));
    expect(result.current.isFocused).toBe(true);
  });

  it('el último blur manda cuando se alterna foco y desenfoque', () => {
    const { result } = setup();

    act(() => result.current.onFocus());
    act(() => result.current.onBlur());
    act(() => result.current.onFocus());
    act(() => result.current.onBlur());

    act(() => void vi.advanceTimersByTime(199));
    expect(result.current.isFocused).toBe(true);

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.isFocused).toBe(false);
  });
});
