#!/usr/bin/env node
/**
 * Capturas de la UI para comparar antes/después de un cambio de diseño.
 *
 * Inicia sesión con la cuenta de pruebas (E2E_EMAIL / E2E_PASSWORD de
 * `.env.local`) y recorre las pantallas principales a 390 px en los dos temas.
 * Reutiliza la sesión entre pantallas: un solo login por ejecución.
 *
 * Uso:
 *   node scripts/ui-shots.mjs <carpeta-destino> [--tema oscuro|claro|ambos]
 *
 * Ejemplo:
 *   node scripts/ui-shots.mjs .shots/antes
 *   node scripts/ui-shots.mjs .shots/despues
 *
 * Requiere el servidor de desarrollo en http://localhost:5173.
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.UI_SHOTS_BASE ?? 'http://localhost:5173';

const destino = process.argv[2];
if (!destino) {
  console.error('Falta la carpeta de destino.\n  node scripts/ui-shots.mjs .shots/antes');
  process.exit(1);
}
const temaPedido = process.argv.includes('--tema')
  ? process.argv[process.argv.indexOf('--tema') + 1]
  : 'ambos';

/** Lee .env.local sin dependencias: solo necesito dos claves. */
function leerEnvLocal() {
  const ruta = resolve(raiz, '.env.local');
  if (!existsSync(ruta)) return {};
  const out = {};
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = leerEnvLocal();
const EMAIL = process.env.E2E_EMAIL ?? env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD ?? env.E2E_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Faltan E2E_EMAIL / E2E_PASSWORD en .env.local. Ver scripts/seed-e2e-user.sql');
  process.exit(1);
}

/** Las pantallas que importan para juzgar el sistema de diseño. */
const PANTALLAS = [
  { ruta: '/', nombre: 'home' },
  { ruta: '/routines', nombre: 'rutinas' },
  { ruta: '/stats', nombre: 'estadisticas' },
  { ruta: '/history', nombre: 'historial' },
  { ruta: '/user-stats', nombre: 'usuario' },
  { ruta: '/exercises', nombre: 'ejercicios' },
  { ruta: '/cardio', nombre: 'cardio' },
  { ruta: '/settings', nombre: 'ajustes' },
];

const temas = temaPedido === 'ambos' ? ['oscuro', 'claro'] : [temaPedido];

const carpeta = resolve(raiz, destino);
mkdirSync(carpeta, { recursive: true });

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const pagina = await contexto.newPage();

// El modal de permisos tapa la primera pantalla y no es lo que se audita.
await pagina.addInitScript(() => localStorage.setItem('gymlog_permissions_seen', 'true'));

console.log(`\nCapturando en ${destino} — ${temas.join(' + ')}\n`);

// ── Login (una vez) ────────────────────────────────────────────────
await pagina.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await pagina.fill('input[type="email"]', EMAIL);
await pagina.fill('input[type="password"]', PASSWORD);
await pagina.click('button:has-text("Iniciar sesión")');
await pagina.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
console.log('  sesión iniciada');

for (const tema of temas) {
  // El tema vive en el store persistido de ajustes; la clase en <html> es lo
  // que lee el CSS, así que se fija a mano para no depender de la UI.
  await pagina.evaluate((t) => {
    const clave = 'gymlog-settings';
    try {
      const crudo = JSON.parse(localStorage.getItem(clave) ?? '{}');
      crudo.state = { ...(crudo.state ?? {}), theme: t === 'claro' ? 'light' : 'dark' };
      localStorage.setItem(clave, JSON.stringify(crudo));
    } catch {
      /* si el store aún no existe, la clase basta para la captura */
    }
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(t === 'claro' ? 'light' : 'dark');
  }, tema);

  for (const { ruta, nombre } of PANTALLAS) {
    await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
    // Reaplica la clase: la recarga la pierde si el store no la respalda.
    await pagina.evaluate((t) => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(t === 'claro' ? 'light' : 'dark');
    }, tema);
    // Deja acabar las animaciones de entrada y el pintado de los gráficos.
    await pagina.waitForTimeout(900);
    const fichero = join(carpeta, `${tema}-${nombre}.png`);
    await pagina.screenshot({ path: fichero, fullPage: true });
    console.log(`  ${tema.padEnd(7)} ${nombre}`);
  }
}

await navegador.close();
console.log(`\nListo: ${temas.length * PANTALLAS.length} capturas en ${destino}\n`);
