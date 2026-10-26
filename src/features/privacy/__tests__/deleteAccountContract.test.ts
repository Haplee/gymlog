/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrato de seguridad de la Edge Function de borrado.
 *
 * No es un test de integración: la función corre en Deno y necesita un proyecto
 * Supabase real, que no se toca desde aquí. Lo que se comprueba es que la única
 * fuente del identificador es el JWT y que no se puede borrar a otra persona
 * enviando un id en el cuerpo. Es una prueba estática, y así se documenta.
 */
const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/delete-account/index.ts'),
  'utf8',
);

describe('delete-account', () => {
  it('verifica el JWT con Auth y saca el id del token', () => {
    expect(source).toContain('auth.getUser(token)');
    expect(source).toContain('const userId = userData.user.id');
    expect(source).toContain("authHeader.startsWith('Bearer ')");
  });

  it('no acepta un userId del cuerpo de la petición', () => {
    expect(source).not.toMatch(/req\.json\s*\(/);
    expect(source).not.toMatch(/body\s*\.\s*userId/);
  });

  it('solo borra después de autenticar', () => {
    const authIndex = source.indexOf('auth.getUser(token)');
    const deleteIndex = source.indexOf('admin.deleteUser(userId)');
    expect(authIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(authIndex);
  });

  it('limpia los avatares del usuario antes de borrar la cuenta', () => {
    expect(source).toContain("from('avatars').list(userId");
    expect(source).toContain('storage_cleanup_failed');
  });

  it('responde 401 sin token y 405 con método distinto de POST', () => {
    expect(source).toContain("json({ error: 'unauthorized' }, 401)");
    expect(source).toContain("json({ error: 'method_not_allowed' }, 405)");
  });

  it('no usa el correo ni el nombre en los logs', () => {
    expect(source).not.toMatch(/userData\.user\.email/);
    expect(source).not.toMatch(/console\.log\([^)]*full_name/);
  });
});
