#!/usr/bin/env node
// Comprueba que en `dist/` no ha acabado ninguna credencial que deba vivir solo
// en el servidor (tarea 2.V8 del plan del entrenador).
//
// Por qué existe: la clave del proveedor de IA vive en `Deno.env` de la Edge
// Function y ninguna `VITE_*` la toca. Eso es una regla, y las reglas se
// incumplen. Un `VITE_AI_COACH_API_KEY` añadido con prisa un martes compila,
// pasa los tests, despliega — y publica la clave, porque el bundle y el APK son
// ficheros que cualquiera puede abrir.
//
// La clave anónima de Supabase SÍ debe estar en el bundle: es pública por
// diseño y la protege la RLS. Por eso no basta con buscar "eyJ": hay que mirar
// el rol que lleva dentro el JWT.
//
// Uso: node scripts/check-bundle-secrets.mjs [directorio]   (por defecto dist)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.argv[2] ?? 'dist';

/** Extensiones donde puede esconderse texto. Las imágenes no se leen. */
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.json', '.map', '.txt']);

/**
 * Patrones de credencial. Cada uno lleva por qué está: un patrón sin motivo se
 * acaba borrando el día que da un falso positivo.
 */
const PATTERNS = [
  { name: 'clave de Groq', re: /gsk_[A-Za-z0-9]{20,}/ },
  { name: 'clave de NVIDIA NIM', re: /nvapi-[A-Za-z0-9_-]{20,}/ },
  { name: 'clave estilo OpenAI', re: /(?:^|[^A-Za-z0-9_])sk-[A-Za-z0-9_-]{20,}/ },
  // Los nombres de los secretos del servidor no tienen nada que hacer en el
  // cliente: si aparecen, alguien ha intentado leerlos desde el bundle.
  { name: 'nombre de secreto del servidor', re: /AI_COACH_(?:FALLBACK_)?API_KEY/ },
  { name: 'secreto compartido de send-push', re: /x-send-secret/i },
];

/** JWT con tres partes. Se mira el payload, no la forma. */
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

/** Devuelve el rol que declara un JWT, o null si no se puede leer. */
function roleOf(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

let files = [];
try {
  files = [...walk(ROOT)].filter((f) => TEXT_EXTENSIONS.has(extname(f)));
} catch {
  console.error(`[check-bundle-secrets] No se encuentra "${ROOT}". ¿Falta el build?`);
  process.exit(1);
}

const findings = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');

  for (const { name, re } of PATTERNS) {
    if (re.test(content)) findings.push(`${file}: ${name}`);
  }

  for (const token of content.match(JWT_RE) ?? []) {
    const role = roleOf(token);
    // `anon` es correcto y esperado. Cualquier otro rol en el cliente es un
    // fallo grave: service_role se salta la RLS entera.
    if (role && role !== 'anon') findings.push(`${file}: JWT con rol "${role}"`);
  }
}

if (findings.length > 0) {
  console.error('[check-bundle-secrets] Credenciales en el bundle:');
  for (const f of findings) console.error(`  - ${f}`);
  console.error('\nNada de esto puede publicarse. Si alguna es real, ROTALA antes de nada.');
  process.exit(1);
}

console.log(`[check-bundle-secrets] ${files.length} ficheros revisados en "${ROOT}". Limpio.`);
