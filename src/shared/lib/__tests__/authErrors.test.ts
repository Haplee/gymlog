import { describe, it, expect } from 'vitest';
import { getAuthErrorMessage } from '../authErrors';

describe('getAuthErrorMessage', () => {
  it('devuelve "Error desconocido" si no es un Error', () => {
    expect(getAuthErrorMessage(null)).toBe('Error desconocido');
    expect(getAuthErrorMessage('boom')).toBe('Error desconocido');
    expect(getAuthErrorMessage({ message: 'x' })).toBe('Error desconocido');
  });

  it('detecta errores de red', () => {
    expect(getAuthErrorMessage(new Error('Network request failed'))).toBe(
      'Sin conexión. Verifica tu internet.',
    );
    expect(getAuthErrorMessage(new Error('Failed to fetch'))).toBe(
      'Sin conexión. Verifica tu internet.',
    );
  });

  it('detecta credenciales inválidas', () => {
    expect(getAuthErrorMessage(new Error('Invalid login credentials'))).toBe(
      'Email o contraseña incorrectos',
    );
  });

  it('detecta email ya registrado', () => {
    expect(getAuthErrorMessage(new Error('User already registered'))).toBe(
      'Este email ya está registrado',
    );
  });

  it('detecta email sin confirmar', () => {
    expect(getAuthErrorMessage(new Error('Email not confirmed'))).toBe(
      'Confirma tu email antes de iniciar sesión',
    );
  });

  it('detecta rate limit', () => {
    expect(getAuthErrorMessage(new Error('Rate limit exceeded'))).toBe(
      'Demasiados intentos. Intenta de nuevo más tarde',
    );
  });

  it('detecta sesión expirada (mensaje real de Supabase con mayúsculas)', () => {
    // Regresión: el mensaje se comparaba en minúsculas contra un literal con
    // mayúsculas, así que este caso nunca coincidía.
    expect(getAuthErrorMessage(new Error('Invalid Refresh Token: Expired refresh token'))).toBe(
      'Sesión expirada. Inicia sesión de nuevo',
    );
    expect(getAuthErrorMessage(new Error('token has expired'))).toBe(
      'Sesión expirada. Inicia sesión de nuevo',
    );
  });

  it('cae al mensaje genérico para errores no reconocidos', () => {
    expect(getAuthErrorMessage(new Error('something weird'))).toBe(
      'Error de autenticación. Intenta de nuevo',
    );
  });
});
