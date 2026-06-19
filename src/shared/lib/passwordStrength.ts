/**
 * Validación de fuerza de contraseña en cliente.
 *
 * Mitigación gratuita en lugar de "Leaked Password Protection" de Supabase
 * (HaveIBeenPwned), que requiere plan Pro. No consulta HIBP: aplica reglas
 * locales (longitud, mezcla de tipos) y bloquea una lista corta de
 * contraseñas muy comunes.
 *
 * Solo se aplica en el REGISTRO. El login mantiene la regla mínima histórica
 * para no bloquear cuentas creadas antes.
 */

export const PASSWORD_MIN_LENGTH = 8;

// Lista corta de contraseñas/patrones más filtrados (normalizados a minúsculas).
// No pretende ser exhaustiva — corta lo evidente sin coste de red.
const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'passw0rd',
  'qwerty123',
  'qwertyuiop',
  '11111111',
  '00000000',
  'iloveyou',
  'admin123',
  'welcome1',
  'abc12345',
  'gymlog123',
]);

export interface PasswordCheck {
  ok: boolean;
  message?: string;
}

/**
 * Comprueba si una contraseña cumple los requisitos mínimos de registro.
 * @returns { ok: true } o { ok: false, message } con el primer fallo.
 */
export function checkPasswordStrength(password: string): PasswordCheck {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { ok: false, message: 'La contraseña debe incluir al menos una letra' };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: 'La contraseña debe incluir al menos un número' };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, message: 'Esa contraseña es demasiado común, elige otra' };
  }
  return { ok: true };
}
