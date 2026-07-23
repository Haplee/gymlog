/**
 * Genera los recursos Android del icono de la app, uno por color de acento.
 *
 * La fuente única de verdad es src/shared/constants/accents.ts: aquí solo se
 * leen los pares (id, primary, fg) del tema oscuro, que es el que da el icono
 * vivo. Si añades un acento allí, ejecuta este script y quedan generados el
 * color, el foreground, el adaptive-icon y el fallback para API 24-25.
 *
 *   node scripts/generate-icon-variants.mjs
 *
 * El fragmento de <activity-alias> que hay que pegar en AndroidManifest.xml se
 * imprime por consola: el manifest NO se toca automáticamente para no pisar
 * cambios hechos a mano.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const RES = join(ROOT, 'android/app/src/main/res');

// Extrae los bloques `{ id: 'x', dark: { primary: '#..', ..., fg: '#..' } }`.
const src = readFileSync(join(ROOT, 'src/shared/constants/accents.ts'), 'utf8');
const re =
  /id:\s*'([a-z]+)',\s*dark:\s*\{\s*primary:\s*'(#[0-9a-f]{6})',\s*dim:\s*'#[0-9a-f]{6}',\s*fg:\s*'(#[0-9a-f]{6})'/gi;
const variants = [...src.matchAll(re)].map(([, id, primary, fg]) => ({ id, primary, fg }));

if (variants.length === 0) {
  console.error('No se ha podido leer ningún acento de accents.ts — ¿cambió el formato?');
  process.exit(1);
}

/** Trazos del logo (mancuerna dentro de un círculo), en viewport de 48. */
const paths = (color) => `    <path
        android:fillColor="#00000000"
        android:strokeColor="${color}"
        android:strokeWidth="4.5"
        android:pathData="M6.5,24a17.5,17.5 0 1,0 35,0a17.5,17.5 0 1,0 -35,0" />
    <path
        android:fillColor="${color}"
        android:pathData="M16.5,24a2,2 0 0 1 2,2V30a2,2 0 0 1 -4,0V26a2,2 0 0 1 2,-2z" />
    <path
        android:fillColor="${color}"
        android:pathData="M24,19a2,2 0 0 1 2,2V30a2,2 0 0 1 -4,0V21a2,2 0 0 1 2,-2z" />
    <path
        android:fillColor="${color}"
        android:pathData="M31.5,14a2,2 0 0 1 2,2V30a2,2 0 0 1 -4,0V16a2,2 0 0 1 2,-2z" />`;

const foreground = (fg) => `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="48"
    android:viewportHeight="48">
${paths(fg)}
</vector>
`;

const adaptive = (id) => `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_bg_${id}"/>
    <foreground>
        <inset android:drawable="@drawable/ic_fg_${id}" android:inset="12%" />
    </foreground>
    <monochrome>
        <inset android:drawable="@drawable/ic_launcher_monochrome" android:inset="12%" />
    </monochrome>
</adaptive-icon>
`;

/**
 * Fallback para API 24-25, que no entienden <adaptive-icon>: el mismo logo pero
 * con el fondo pintado dentro del propio vector, sin máscara del sistema.
 */
const legacy = (primary, fg) => `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="48"
    android:viewportHeight="48">
    <path android:fillColor="${primary}" android:pathData="M0,0h48v48h-48z" />
${paths(fg)}
</vector>
`;

// Los generados viven en carpetas propias: se pueden borrar enteras sin miedo
// a llevarse por delante el icono por defecto ni ningún recurso escrito a mano.
const dirs = {
  fg: join(RES, 'drawable'),
  legacy: join(RES, 'drawable'),
  adaptive: join(RES, 'drawable-anydpi-v26'),
};
mkdirSync(dirs.adaptive, { recursive: true });

// Limpia los generados de una pasada anterior (por si se quita un acento).
for (const dir of [dirs.fg, dirs.adaptive]) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSafe(dir)) {
    if (/^(ic_fg_|ic_launcher_variant_)/.test(f)) rmSync(join(dir, f));
  }
}

const colors = [];
for (const { id, primary, fg } of variants) {
  colors.push(`    <color name="ic_bg_${id}">${primary}</color>`);
  writeFileSync(join(dirs.fg, `ic_fg_${id}.xml`), foreground(fg));
  writeFileSync(join(dirs.legacy, `ic_launcher_variant_${id}.xml`), legacy(primary, fg));
  writeFileSync(join(dirs.adaptive, `ic_launcher_variant_${id}.xml`), adaptive(id));
}

writeFileSync(
  join(RES, 'values/ic_launcher_variants.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<!-- GENERADO por scripts/generate-icon-variants.mjs — no editar a mano. -->
<resources>
${colors.join('\n')}
</resources>
`,
);

const aliases = variants
  .map(
    ({ id }) => `        <activity-alias
            android:name=".IconAlias_${id}"
            android:targetActivity=".MainActivity"
            android:icon="@drawable/ic_launcher_variant_${id}"
            android:roundIcon="@drawable/ic_launcher_variant_${id}"
            android:label="@string/app_name"
            android:enabled="false"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>`,
  )
  .join('\n');

writeFileSync(join(ROOT, 'android/manifest-aliases.generated.xml'), `${aliases}\n`);

console.log(`Generados ${variants.length} iconos: ${variants.map((v) => v.id).join(', ')}`);
console.log('Alias para AndroidManifest.xml en android/manifest-aliases.generated.xml');

function readdirSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
