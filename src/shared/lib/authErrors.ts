/**
 * Mapea errores de Supabase Auth a mensajes usuario-friendly
 * @param error - Error de Supabase o genérico
 * @returns Mensaje traducible para el usuario
 */
export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Error desconocido';
  }

  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return 'Sin conexión. Verifica tu internet.';
  }
  if (message.includes('invalid') || message.includes('credentials')) {
    return 'Email o contraseña incorrectos';
  }
  if (message.includes('user already registered')) {
    return 'Este email ya está registrado';
  }
  if (message.includes('email not confirmed')) {
    return 'Confirma tu email antes de iniciar sesión';
  }
  if (message.includes('rate limit')) {
    return 'Demasiados intentos. Intenta de nuevo más tarde';
  }
  if (message.includes('Expired refresh token')) {
    return 'Sesión expirada. Inicia sesión de nuevo';
  }

  return 'Error de autenticación. Intenta de nuevo';
}
