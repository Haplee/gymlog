// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { grantHealthConsent } from '../../consent/healthConsent';
import { useHealthConsentGate } from '../useHealthConsentGate';

const USER = 'user-1';

beforeEach(() => {
  localStorage.clear();
});

describe('useHealthConsentGate', () => {
  it('ejecuta la acción sin diálogo si ya hay consentimiento', () => {
    grantHealthConsent(USER);
    const { result } = renderHook(() => useHealthConsentGate(USER));
    const action = vi.fn();

    act(() => result.current.requireConsent(action));

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isDialogOpen).toBe(false);
  });

  it('abre el diálogo y aplaza la acción si no hay consentimiento', () => {
    const { result } = renderHook(() => useHealthConsentGate(USER));
    const action = vi.fn();

    act(() => result.current.requireConsent(action));

    expect(action).not.toHaveBeenCalled();
    expect(result.current.isDialogOpen).toBe(true);

    act(() => result.current.accept());

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.hasConsent).toBe(true);
  });

  it('cancelar descarta la acción y no guarda consentimiento', () => {
    const { result } = renderHook(() => useHealthConsentGate(USER));
    const action = vi.fn();

    act(() => result.current.requireConsent(action));
    act(() => result.current.cancel());

    expect(action).not.toHaveBeenCalled();
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.hasConsent).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it('sin usuario abre el diálogo y no guarda nada al aceptar', () => {
    const { result } = renderHook(() => useHealthConsentGate(undefined));
    const action = vi.fn();

    act(() => result.current.requireConsent(action));
    expect(result.current.isDialogOpen).toBe(true);

    act(() => result.current.accept());
    expect(action).toHaveBeenCalledTimes(1);
    expect(localStorage.length).toBe(0);
  });
});
