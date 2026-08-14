#!/usr/bin/env node
/**
 * Auditoría de contraste del sistema de diseño.
 *
 * Lee los tokens reales de `src/shared/styles/tokens.css` y los 24 acentos de
 * `src/shared/constants/accents.ts`, y comprueba los suelos que la app tiene
 * que cumplir en los dos temas. Sale con código ≠ 0 si alguno se rompe.
 *
 * Existe porque estas cuentas se estaban haciendo a mano, una vez, y nadie las
 * repetía al tocar un token. El reskin de julio pasó por eso: cada decisión se
 * midió por separado y nadie midió la suma.
 *
 * Uso:
 *   npm run audit:contrast          # tabla resumida, solo fallos en detalle
 *   npm run audit:contrast -- -v    # todas las comprobaciones
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSO = process.argv.includes('-v') || process.argv.includes('--verbose');

/* ── Suelos exigidos ───────────────────────────────────────────────
   Los define `openspec/changes/recalibrate-fitbody-hierarchy/specs/
   visual-hierarchy-budget/spec.md`. Si cambias uno aquí, cambia el spec. */
const SUELO = {
  textoAA: 4.5, // WCAG 1.4.3 texto normal
  noTexto: 3.0, // WCAG 1.4.11 límites de componentes de interfaz
  superficieVsCanvas: 1.15, // una tarjeta tiene que despegarse del fondo
  superficieVsSuperficie: 1.1, // y dos niveles, distinguirse entre sí
};

/* ══ Color ════════════════════════════════════════════════════════ */

/** Canal sRGB → lineal, según la definición de WCAG. */
const aLineal = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminancia = ({ r, g, b }) =>
  0.2126 * aLineal(r) + 0.7152 * aLineal(g) + 0.0722 * aLineal(b);

const contraste = (x, y) => {
  const [a, b] = [luminancia(x), luminancia(y)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** Compone `frente` (con alpha) sobre `fondo` (opaco). */
const componer = (frente, fondo) => ({
  r: frente.r * frente.a + fondo.r * (1 - frente.a),
  g: frente.g * frente.a + fondo.g * (1 - frente.a),
  b: frente.b * frente.a + fondo.b * (1 - frente.a),
  a: 1,
});

/**
 * Parsea las formas de color que aparecen en tokens.css:
 * `#rrggbb`, `rgb(r g b / a)`, `rgba(r, g, b, a)` y `rgb(var(--x) / a)`.
 * Devuelve null si no reconoce la cadena (un gradiente entero, por ejemplo).
 */
function parseColor(valor, vars) {
  if (!valor) return null;
  const v = valor.trim();

  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }

  // rgb(var(--algo) / 0.28) — el var() aporta los tres canales
  const conVar = v.match(/^rgba?\(\s*var\(\s*(--[\w-]+)\s*\)\s*(?:\/\s*([\d.]+))?\s*\)$/i);
  if (conVar) {
    const canales = (vars.get(conVar[1]) ?? '').trim().split(/[\s,]+/).map(Number);
    if (canales.length < 3 || canales.some(Number.isNaN)) return null;
    return { r: canales[0], g: canales[1], b: canales[2], a: Number(conVar[2] ?? 1) };
  }

  const rgb = v.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const partes = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (partes.length < 3 || partes.slice(0, 3).some(Number.isNaN)) return null;
    return { r: partes[0], g: partes[1], b: partes[2], a: partes[3] ?? 1 };
  }

  return null;
}

/** Resuelve `var(--x)` encadenados hasta dar con un color literal. */
function resolver(nombre, vars, saltos = 0) {
  if (saltos > 10) return null;
  const bruto = vars.get(nombre);
  if (!bruto) return null;
  const soloVar = bruto.trim().match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (soloVar) return resolver(soloVar[1], vars, saltos + 1);
  return parseColor(bruto, vars);
}

/** Primer color de un `linear-gradient(...)`: el extremo más cargado del velo. */
function primerColorDeGradiente(valor, vars) {
  if (!valor) return null;
  const m = valor.match(/rgba?\([^)]*\)/);
  return m ? parseColor(m[0], vars) : null;
}

/* ══ Lectura de los tokens ════════════════════════════════════════ */

/**
 * Extrae las custom properties de un bloque CSS por selector.
 * tokens.css es plano (`:root { … }` y `:root.light { … }`), así que basta
 * con recortar entre la llave de apertura y la de cierre del bloque.
 */
/**
 * Comprueba que los comentarios abren y cierran bien ANTES de mirar colores.
 *
 * Un `*​/` huérfano deja texto suelto entre declaraciones. El servidor de
 * desarrollo lo tolera y la pantalla se ve bien; el minificador del build no,
 * y la app nativa sale con las superficies rotas. Pasó exactamente así: las
 * capturas del navegador estaban perfectas y la APK tenía los modales
 * transparentes. Un fichero de tokens sintácticamente roto no es auditable,
 * así que esto corta antes de dar un verde que no significa nada.
 */
function comprobarComentarios(css, fichero) {
  let profundidad = 0;
  const problemas = [];
  for (const m of css.matchAll(/\/\*|\*\//g)) {
    const linea = css.slice(0, m.index).split('\n').length;
    if (m[0] === '/*') {
      if (profundidad > 0) problemas.push(`${fichero}:${linea} comentario anidado`);
      profundidad++;
    } else if (profundidad === 0) {
      problemas.push(`${fichero}:${linea} cierre de comentario huérfano`);
    } else {
      profundidad--;
    }
  }
  if (profundidad > 0) problemas.push(`${fichero}: queda un comentario sin cerrar`);
  if (problemas.length > 0) {
    console.error('\nCSS con comentarios mal formados — el build lo romperá:\n');
    for (const p of problemas) console.error(`  ✗ ${p}`);
    console.error('');
    process.exit(1);
  }
}

function leerBloque(cssConComentarios, selector) {
  // Fuera los comentarios ANTES de nada. Un comentario que mencione un token
  // ("en claro sí se toca --bg-canvas: …") hace que el regex de abajo lo lea
  // como si fuera la declaración real y se trague el valor de verdad. Pasó, y
  // el resultado fue una auditoría en verde que no estaba comprobando el
  // canvas del tema claro. Un falso verde es peor que un fallo.
  const css = cssConComentarios.replace(/\/\*[\s\S]*?\*\//g, '');

  const inicio = css.indexOf(selector);
  if (inicio === -1) throw new Error(`No encuentro el bloque "${selector}" en tokens.css`);
  const abre = css.indexOf('{', inicio);
  const cierra = css.indexOf('\n}', abre);
  const cuerpo = css.slice(abre + 1, cierra);

  const vars = new Map();
  for (const [, nombre, valor] of cuerpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars.set(nombre, valor.trim());
  }
  return vars;
}

const css = readFileSync(resolve(raiz, 'src/shared/styles/tokens.css'), 'utf8');
comprobarComentarios(css, 'tokens.css');
comprobarComentarios(readFileSync(resolve(raiz, 'src/index.css'), 'utf8'), 'index.css');
const oscuro = leerBloque(css, ':root {');
const clarito = leerBloque(css, ':root.light {');
// El tema claro solo redefine parte de los tokens: hereda el resto de :root.
const claro = new Map([...oscuro, ...clarito]);

/** Los 24 acentos, leídos del fichero fuente para no duplicar la lista. */
function leerAcentos() {
  const ts = readFileSync(resolve(raiz, 'src/shared/constants/accents.ts'), 'utf8');
  const presets = [];
  for (const bloque of ts.matchAll(
    /id:\s*'([\w-]+)',\s*dark:\s*\{([^}]+)\},\s*light:\s*\{([^}]+)\}/g,
  )) {
    const campo = (txt, clave) => txt.match(new RegExp(`${clave}:\\s*'([^']+)'`))?.[1];
    presets.push({
      id: bloque[1],
      dark: { primary: campo(bloque[2], 'primary'), fg: campo(bloque[2], 'fg') },
      light: { primary: campo(bloque[3], 'primary'), fg: campo(bloque[3], 'fg') },
    });
  }
  if (presets.length === 0) throw new Error('No he podido leer ningún acento de accents.ts');
  return presets;
}

const ACENTOS = leerAcentos();

/* ══ Comprobaciones ═══════════════════════════════════════════════ */

const resultados = [];

const comprobar = (tema, grupo, etiqueta, ratio, suelo) => {
  resultados.push({ tema, grupo, etiqueta, ratio, suelo, pasa: ratio >= suelo - 1e-9 });
};

/** El acento más claro del tema: es el que manda en el peor caso del vidrio. */
function acentoMasClaro(tema) {
  return ACENTOS.map((a) => ({ id: a.id, color: parseColor(a[tema].primary, new Map()) }))
    .filter((a) => a.color)
    .sort((x, y) => luminancia(y.color) - luminancia(x.color))[0];
}

function auditarTema(nombreTema, vars, claveAcento) {
  const t = (n) => resolver(n, vars);
  const canvas = t('--bg-canvas');
  const superficies = ['--bg-surface', '--bg-surface-2', '--bg-surface-3'].map((n) => ({
    nombre: n,
    color: t(n),
  }));
  const textos = ['--text-primary', '--text-secondary', '--text-tertiary'].map((n) => ({
    nombre: n,
    color: t(n),
  }));

  // 1. Texto sobre cada superficie opaca (incluido el canvas).
  for (const sup of [{ nombre: '--bg-canvas', color: canvas }, ...superficies]) {
    for (const txt of textos) {
      if (!sup.color || !txt.color) continue;
      comprobar(
        nombreTema,
        'texto',
        `${txt.nombre} sobre ${sup.nombre}`,
        contraste(txt.color, sup.color),
        SUELO.textoAA,
      );
    }
  }

  // 2. Separación de superficies: lo que hace que una tarjeta se vea.
  if (canvas && superficies[0].color) {
    comprobar(
      nombreTema,
      'jerarquía',
      'canvas → --bg-surface',
      contraste(canvas, superficies[0].color),
      SUELO.superficieVsCanvas,
    );
  }
  for (let i = 0; i < superficies.length - 1; i++) {
    const [a, b] = [superficies[i], superficies[i + 1]];
    if (!a.color || !b.color) continue;
    comprobar(
      nombreTema,
      'jerarquía',
      `${a.nombre} → ${b.nombre}`,
      contraste(a.color, b.color),
      SUELO.superficieVsSuperficie,
    );
  }

  // 3. Bordes de controles: WCAG 1.4.11. Se miden contra el canvas y contra
  //    la superficie, porque un input vive sobre cualquiera de las dos.
  const bordeInteractivo = t('--border-interactive');
  if (bordeInteractivo) {
    for (const fondo of [{ nombre: '--bg-canvas', color: canvas }, ...superficies]) {
      if (!fondo.color) continue;
      comprobar(
        nombreTema,
        'bordes',
        `--border-interactive sobre ${fondo.nombre}`,
        contraste(bordeInteractivo, fondo.color),
        SUELO.noTexto,
      );
    }
  } else {
    resultados.push({
      tema: nombreTema,
      grupo: 'bordes',
      etiqueta: '--border-interactive no existe todavía',
      ratio: 0,
      suelo: SUELO.noTexto,
      pasa: false,
    });
  }

  // 4. El acento como relleno con su texto encima (botón primario).
  for (const a of ACENTOS) {
    const fondo = parseColor(a[claveAcento].primary, vars);
    const frente = parseColor(a[claveAcento].fg, vars);
    if (!fondo || !frente) continue;
    comprobar(nombreTema, 'acentos', `fg sobre acento «${a.id}»`, contraste(frente, fondo), SUELO.textoAA);
  }

  // 5. El caso que hundió al reskin: texto sobre una capa de vidrio con el
  //    acento MÁS CLARO pasando por debajo. La capa es translúcida, así que
  //    parte de ese acento la atraviesa, y encima va el velo.
  const peor = acentoMasClaro(claveAcento);
  const velo = primerColorDeGradiente(vars.get('--glass-veil'), vars);
  for (const capa of ['--glass-1', '--glass-2', '--glass-3']) {
    const vidrio = resolver(capa, vars);
    if (!vidrio || !peor) continue;
    let efectivo = componer(vidrio, peor.color);
    if (velo) efectivo = componer(velo, efectivo);
    for (const txt of textos) {
      if (!txt.color) continue;
      comprobar(
        nombreTema,
        'vidrio',
        `${txt.nombre} en ${capa} sobre «${peor.id}»`,
        contraste(txt.color, efectivo),
        SUELO.textoAA,
      );
    }
  }
}

auditarTema('oscuro', oscuro, 'dark');
auditarTema('claro', claro, 'light');

/* ══ Informe ══════════════════════════════════════════════════════ */

const fallos = resultados.filter((r) => !r.pasa);
const linea = (r) =>
  `  ${r.pasa ? '·' : '✗'} ${r.etiqueta.padEnd(46)} ${r.ratio.toFixed(3).padStart(7)}:1  (mín ${r.suelo})`;

console.log(`\nAuditoría de contraste — ${ACENTOS.length} acentos, 2 temas\n`);

for (const tema of ['oscuro', 'claro']) {
  const delTema = resultados.filter((r) => r.tema === tema);
  const malos = delTema.filter((r) => !r.pasa);
  console.log(`${tema.toUpperCase()}  ${delTema.length - malos.length}/${delTema.length} ok`);

  for (const grupo of ['texto', 'jerarquía', 'bordes', 'acentos', 'vidrio']) {
    const delGrupo = delTema.filter((r) => r.grupo === grupo);
    if (delGrupo.length === 0) continue;
    const malosDelGrupo = delGrupo.filter((r) => !r.pasa);
    const peorRatio = Math.min(...delGrupo.map((r) => r.ratio));
    console.log(
      `  ${grupo.padEnd(11)} ${String(delGrupo.length - malosDelGrupo.length).padStart(3)}/${String(delGrupo.length).padEnd(3)}  peor ${peorRatio.toFixed(3)}:1`,
    );
    for (const r of VERBOSO ? delGrupo : malosDelGrupo) console.log(linea(r));
  }
  console.log('');
}

if (fallos.length > 0) {
  console.error(`FALLA: ${fallos.length} de ${resultados.length} comprobaciones por debajo del suelo.\n`);
  process.exit(1);
}
console.log(`Todo en verde: ${resultados.length} comprobaciones.\n`);
