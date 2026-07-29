#!/usr/bin/env node
// Regenera src/types/database.types.ts desde el proyecto de Supabase.
//
// Por qué no es un one-liner con `>` en package.json: la redirección del shell
// trunca el fichero ANTES de ejecutar el comando. Si el CLI falla —no está en
// el PATH, no hay sesión, no hay red— te quedas con un database.types.ts vacío
// y con el fallo enterrado detrás de un exit 0. Pasó.
//
// Aquí solo se escribe si el CLI termina bien y ha devuelto algo con pinta de
// fichero de tipos.

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PROJECT_ID = 'eoltmipoklizewxdpzfa';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'types', 'database.types.ts');

// Se pasa el comando como una sola cadena con `shell: true`. Node 20+ rechaza
// ejecutar `npx.cmd` sin shell (EINVAL), y pasar además un array de argumentos
// con shell activo dispara un aviso de deprecación. El único valor variable es
// PROJECT_ID, que es una constante de este fichero: no hay entrada de usuario.
const result = spawnSync(
  `npx --yes supabase gen types typescript --project-id ${PROJECT_ID}`,
  { encoding: 'utf8', shell: true },
);

if (result.error || result.status !== 0) {
  console.error('[gen:types] El CLI de Supabase ha fallado. No se ha tocado database.types.ts.');
  console.error(result.stderr?.trim() || result.error?.message || `exit ${result.status}`);
  console.error('Comprueba la sesión con: npx supabase login');
  process.exit(1);
}

const types = result.stdout ?? '';
if (!types.includes('export type Database')) {
  console.error('[gen:types] La salida no parece un fichero de tipos. No se ha tocado nada.');
  process.exit(1);
}

writeFileSync(OUT, types);
console.log(`[gen:types] Escrito ${OUT} (${types.length} caracteres).`);
