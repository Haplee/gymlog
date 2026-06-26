import { describe, it, expect } from 'vitest';
import { checkPasswordStrength, PASSWORD_MIN_LENGTH } from '../passwordStrength';

describe('checkPasswordStrength', () => {
  it('rechaza contraseñas demasiado cortas', () => {
    const r = checkPasswordStrength('Ab1');
    expect(r.ok).toBe(false);
    expect(r.message).toContain(String(PASSWORD_MIN_LENGTH));
  });

  it('exige al menos una letra', () => {
    expect(checkPasswordStrength('12345678').ok).toBe(false);
  });

  it('exige al menos un número', () => {
    expect(checkPasswordStrength('abcdefgh').ok).toBe(false);
  });

  it('rechaza contraseñas comunes aunque cumplan el formato', () => {
    expect(checkPasswordStrength('password1').ok).toBe(false);
    expect(checkPasswordStrength('PASSWORD1').ok).toBe(false); // case-insensitive
    expect(checkPasswordStrength('gymlog123').ok).toBe(false);
  });

  it('acepta contraseñas válidas', () => {
    expect(checkPasswordStrength('Tr3ningD1a').ok).toBe(true);
    expect(checkPasswordStrength('miClave2026').ok).toBe(true);
  });
});
