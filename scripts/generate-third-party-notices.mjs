/**
 * Genera `public/third-party-notices.txt` a partir del árbol de dependencias de
 * producción instalado.
 *
 * Por qué un script y no un fichero a mano: un aviso de licencias que se
 * actualiza a mano se queda viejo en la primera actualización de dependencias, y
 * un aviso viejo es peor que ninguno porque afirma algo que ya no es cierto. El
 * script se ejecuta con `npm run notices` y la comprobación con
 * `npm run check:notices`.
 *
 * Qué incluye: todas las rutas de `npm ls --omit=dev --parseable --all`, con el
 * texto de la licencia de cada familia tomado de un paquete instalado (no
 * redactado a mano) y la línea de copyright de cada paquete cuando existe.
 *
 * Qué no incluye: contenido multimedia de ExerciseDB/AscendAPI, fuentes de
 * Google ni binarios nativos. Se documentan aparte al final porque su régimen no
 * es el del árbol npm y no se puede deducir de `package.json`.
 *
 * Uso:
 *   node scripts/generate-third-party-notices.mjs          # escribe el fichero
 *   node scripts/generate-third-party-notices.mjs --check  # falla si está desfasado
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(root, 'public', 'third-party-notices.txt');
const checkOnly = process.argv.includes('--check');

/* ── Inventario ─────────────────────────────────────────────────────────── */

function listProductionPackages() {
  // `shell: true` es necesario en Windows para resolver npm.cmd. Los argumentos
  // son constantes, no vienen del usuario.
  const result = spawnSync('npm', ['ls', '--omit=dev', '--parseable', '--all'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: true,
  });
  const stdout = result.stdout ?? '';
  if (!stdout.trim()) {
    throw new Error(
      `No se pudo leer el árbol de dependencias.\n${result.stderr ?? ''}`,
    );
  }

  const packages = new Map();
  for (const line of stdout.split(/\r?\n/)) {
    const dir = line.trim();
    if (!dir) continue;
    if (resolve(dir) === root) continue; // el propio proyecto no es un tercero
    const manifestPath = join(dir, 'package.json');
    if (!existsSync(manifestPath)) continue;

    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      continue;
    }
    if (!manifest.name || !manifest.version) continue;

    const key = `${manifest.name}@${manifest.version}`;
    if (packages.has(key)) continue;
    packages.set(key, { ...manifest, dir });
  }

  return [...packages.values()].sort((a, b) =>
    a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  );
}

function licenceFiles(dir) {
  try {
    return readdirSync(dir).filter((file) => /^(LICEN[CS]E|COPYING|NOTICE)/i.test(file));
  } catch {
    return [];
  }
}

function readIfExists(dir, file) {
  const path = join(dir, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function declaredLicence(pkg) {
  let licence = pkg.license;
  if (licence && typeof licence === 'object') licence = licence.type;
  if (!licence && Array.isArray(pkg.licenses)) {
    licence = pkg.licenses.map((item) => item?.type).filter(Boolean).join(' OR ');
  }
  return typeof licence === 'string' && licence.trim() ? licence.trim() : 'UNKNOWN';
}

/**
 * Familia(s) de licencia y decisión aplicada.
 *
 * Las expresiones duales se resuelven a la opción que ya usa el proyecto:
 * `jszip` bajo MIT (la alternativa GPL no se usa) y `type-fest` bajo MIT (la
 * alternativa CC0 no cambia nada práctico). `MIT AND Zlib` exige ambos textos.
 */
function licencePlan(declared) {
  switch (declared) {
    case 'MIT':
    case 'MIT/X11':
      return { families: ['MIT'], note: null };
    case 'ISC':
      return { families: ['ISC'], note: null };
    case 'Apache-2.0':
      return { families: ['Apache-2.0'], note: null };
    case 'BSD-2-Clause':
      return { families: ['BSD-2-Clause'], note: null };
    case 'BSD-3-Clause':
      return { families: ['BSD-3-Clause'], note: null };
    case 'BlueOak-1.0.0':
      return { families: ['BlueOak-1.0.0'], note: null };
    case 'MPL-2.0':
      return { families: ['MPL-2.0'], note: null };
    case '0BSD':
      return { families: ['0BSD'], note: null };
    case 'Unlicense':
      return { families: ['Unlicense'], note: null };
    case 'CC-BY-4.0':
      return { families: ['CC-BY-4.0'], note: null };
    case 'MIT AND ISC':
      return { families: ['MIT', 'ISC'], note: null };
    case '(MIT AND Zlib)':
      return { families: ['MIT', 'Zlib'], note: null };
    case '(MIT OR GPL-3.0-or-later)':
      return {
        families: ['MIT'],
        note: 'Doble licencia MIT/GPL-3.0-or-later. GymLog lo usa bajo MIT; no se ejerce la opción GPL.',
      };
    case '(MIT OR CC0-1.0)':
      return {
        families: ['MIT'],
        note: 'Doble licencia MIT/CC0-1.0. GymLog lo usa bajo MIT.',
      };
    default:
      return { families: [], note: null };
  }
}

const LICENCE_TITLES = {
  MIT: 'Licencia MIT',
  ISC: 'Licencia ISC',
  'Apache-2.0': 'Licencia Apache 2.0',
  'BSD-2-Clause': 'Licencia BSD de 2 cláusulas',
  'BSD-3-Clause': 'Licencia BSD de 3 cláusulas',
  'BlueOak-1.0.0': 'Licencia Blue Oak 1.0.0',
  'MPL-2.0': 'Licencia Pública de Mozilla 2.0',
  '0BSD': 'Licencia BSD cero (0BSD)',
  Unlicense: 'Unlicense',
  'CC-BY-4.0': 'Creative Commons Attribution 4.0',
  Zlib: 'Licencia zlib',
};

/** Paquete preferido para tomar el texto canónico de cada familia. */
const CANONICAL_PACKAGE = {
  MIT: 'react',
  ISC: 'idb',
  'Apache-2.0': 'typescript',
  'BSD-2-Clause': 'terser',
  'BSD-3-Clause': 'source-map',
  'BlueOak-1.0.0': 'glob',
  'MPL-2.0': 'lightningcss',
  '0BSD': 'tslib',
  Unlicense: 'big-integer',
  'CC-BY-4.0': 'caniuse-lite',
  Zlib: 'pako',
};

function normaliseLicenceText(text) {
  // Quita la línea de copyright del texto canónico: cada paquete aporta la
  // suya más abajo. Dejarla haría creer que el titular del paquete elegido
  // licencia el resto del árbol.
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line, index) => !(index < 8 && /^\s*(copyright|\(c\)|©)/i.test(line)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function copyrightLine(pkg, texts) {
  for (const text of texts) {
    const match = text.match(/^\s*(Copyright[^\n]*|©[^\n]*)$/im);
    if (match) return match[1].trim().slice(0, 240);
  }
  const author = pkg.author;
  if (typeof author === 'string' && author.trim()) return author.trim();
  if (author && typeof author === 'object' && author.name) return String(author.name);
  return '(titular no indicado en el paquete)';
}

function build() {
  const packages = listProductionPackages();
  const project = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  const grouped = new Map();
  const unknown = [];

  for (const pkg of packages) {
    const declared = declaredLicence(pkg);
    const plan = licencePlan(declared);
    const files = licenceFiles(pkg.dir);
    const texts = files
      .filter((file) => !/^NOTICE/i.test(file))
      .map((file) => readIfExists(pkg.dir, file))
      .filter(Boolean);

    if (plan.families.length === 0) {
      unknown.push({ pkg, declared, files });
      continue;
    }

    for (const family of plan.families) {
      if (!grouped.has(family)) grouped.set(family, []);
      grouped.get(family).push({
        pkg,
        declared,
        copyright: copyrightLine(pkg, texts),
        note: plan.note,
        notice: files
          .filter((file) => /^NOTICE/i.test(file))
          .map((file) => readIfExists(pkg.dir, file))
          .filter(Boolean)
          .join('\n\n'),
      });
    }
  }

  // Texto canónico por familia: del paquete preferido si está instalado; si no,
  // del primero que tenga fichero de licencia. Se reproduce tal cual, sin
  // redactar, para no introducir errores en un texto jurídico.
  const canonical = new Map();
  for (const [family, entries] of grouped) {
    const preferred = entries.find((entry) => entry.pkg.name === CANONICAL_PACKAGE[family]);
    const withFile = entries.find((entry) =>
      licenceFiles(entry.pkg.dir).some((file) => !/^NOTICE/i.test(file)),
    );
    const chosen = preferred ?? withFile ?? entries[0];
    const file = licenceFiles(chosen.pkg.dir).find((name) => !/^NOTICE/i.test(name));
    const raw = file ? readIfExists(chosen.pkg.dir, file) : '';
    canonical.set(family, {
      text: raw ? normaliseLicenceText(raw) : '',
      source: `${chosen.pkg.name}@${chosen.pkg.version}`,
    });
  }

  const lines = [];
  const push = (...values) => lines.push(...values);

  push(
    'GymLog — Avisos de software de terceros',
    '=======================================',
    '',
    'Este fichero se genera automáticamente a partir del árbol de dependencias de',
    'producción instalado. No se edita a mano: ejecuta `npm run notices` después de',
    'cambiar dependencias y `npm run check:notices` para comprobar que está al día.',
    '',
    `Proyecto: ${project.name} ${project.version} — licencia MIT (ver LICENSE).`,
    `Paquetes de producción inventariados: ${packages.length}.`,
    '',
    'El inventario incluye dependencias de compilación declaradas en `dependencies`',
    '(por ejemplo, herramientas de build), por lo que es más amplio que el código',
    'que finalmente se empaqueta. Es el lado seguro: avisar de más no perjudica.',
    '',
    'Contenido no cubierto por este inventario:',
    '- GIFs, imágenes e instrucciones de ExerciseDB/AscendAPI, consumidos por HTTP.',
    '  Su titular es AscendAPI y su licencia de contenido no está documentada; ver',
    '  OSS_LICENSE_REVIEW.md (hallazgo OS-06).',
    '- Fuentes Space Grotesk e Inter, servidas por Google Fonts bajo SIL Open Font',
    '  License. Si se autoalojan, hay que añadir sus ficheros OFL.',
    '- Binarios nativos de Capacitor, Android e iOS, cuyas licencias no se deducen',
    '  del árbol npm.',
    '',
    'Marcas: Android, Google, Firebase, Apple, iOS, Supabase, Vercel, Cloudflare y',
    'Sentry son marcas de sus titulares. Se mencionan solo para describir el servicio.',
    '',
    'Resumen por familia de licencia',
    '-------------------------------',
  );

  const familyOrder = [
    'MIT',
    'ISC',
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'BlueOak-1.0.0',
    'MPL-2.0',
    '0BSD',
    'Unlicense',
    'CC-BY-4.0',
    'Zlib',
  ];

  for (const family of familyOrder) {
    const entries = grouped.get(family);
    if (entries?.length) push(`- ${LICENCE_TITLES[family]}: ${entries.length} paquete(s)`);
  }
  if (unknown.length) push(`- Sin licencia declarada: ${unknown.length} paquete(s)`);
  push('');

  for (const family of familyOrder) {
    const entries = grouped.get(family);
    if (!entries?.length) continue;
    const info = canonical.get(family);
    push('', `${LICENCE_TITLES[family].toUpperCase()}`, '='.repeat(LICENCE_TITLES[family].length), '');
    if (info?.text) {
      push(
        `Texto reproducido del fichero de licencia de ${info.source}.`,
        'Se ha omitido la línea de copyright de ese paquete; la de cada paquete',
        'figura en la lista siguiente.',
        '',
        info.text,
      );
    } else {
      push(
        `No se ha encontrado el texto completo en los paquetes instalados.`,
        `Consulta el texto oficial de ${family} en su fuente habitual y añádelo antes`,
        'de distribuir si el paquete no incluye fichero de licencia.',
      );
    }
    push('', `Paquetes bajo ${family}:`, '');
    for (const entry of entries) {
      push(`- ${entry.pkg.name}@${entry.pkg.version} — ${entry.copyright}`);
      if (entry.note) push(`  Nota: ${entry.note}`);
      if (entry.notice.trim()) {
        push('  Aviso NOTICE del paquete:', '');
        for (const line of entry.notice.trim().split('\n')) push(`  ${line}`);
      }
    }
  }

  if (unknown.length) {
    push('', 'PAQUETES SIN LICENCIA DECLARADA', '================================', '');
    push(
      'Sin licencia declarada, el régimen por defecto es «todos los derechos',
      'reservados». No se afirma que exista permiso: se listan para que la ausencia',
      'quede a la vista y se resuelva antes de distribuir.',
      '',
    );
    for (const { pkg, declared, files } of unknown) {
      push(`- ${pkg.name}@${pkg.version} — declarada: ${declared}; ficheros: ${files.join(', ') || 'ninguno'}.`);
    }
    push('', 'Ver OSS_LICENSE_REVIEW.md (OS-01) para el plan de sustitución.');
  }

  push(
    '',
    'Cómo ejercer los derechos de atribución',
    '---------------------------------------',
    'Este fichero está accesible en la app (Ajustes → Privacidad y datos →',
    'Licencias de terceros) y en la web (/third-party-notices.txt). Para cualquier',
    'corrección de atribución: fvidalmateo@gmail.com.',
    '',
    'Esta lista es un inventario técnico, no un dictamen jurídico.',
    '',
  );

  return `${lines.join('\n')}`;
}

const content = build();

if (checkOnly) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
  if (current !== content) {
    console.error(
      'public/third-party-notices.txt está desactualizado. Ejecuta `npm run notices`.',
    );
    process.exit(1);
  }
  console.log('third-party-notices.txt está al día.');
  process.exit(0);
}

writeFileSync(outputPath, content, 'utf8');
console.log(`Escrito ${outputPath} (${content.length} caracteres).`);
