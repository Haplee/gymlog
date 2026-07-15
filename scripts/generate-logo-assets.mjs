#!/usr/bin/env node
/**
 * Regenera todos los PNG del logo a partir del mark vectorial.
 * Fuente única de la geometría: la misma que public/gimnasia.svg,
 * src/shared/components/ui/GymLogLogo.tsx y android/.../ic_launcher_foreground.xml.
 *
 * Uso: node scripts/generate-logo-assets.mjs
 * Después: node scripts/optimize-images.mjs  (genera los .webp)
 */
import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MINT = '#60eca8';
const INK = '#003822';

const glyph = `
    <g transform="translate(24 24) scale(0.72) translate(-24 -24)" fill="${INK}">
      <circle cx="24" cy="24" r="17.5" fill="none" stroke="${INK}" stroke-width="4.5" />
      <rect x="14.5" y="24" width="4" height="8" rx="2" />
      <rect x="22" y="19" width="4" height="13" rx="2" />
      <rect x="29.5" y="14" width="4" height="18" rx="2" />
    </g>`;

const svg = (size, rx) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="${rx}" fill="${MINT}" />${glyph}
    </svg>`
  );

// rx 10.5 → badge redondeado (favicon, README, marketing).
// rx 0 → a sangre: los iconos maskable de Android e iOS aplican su propia máscara,
// y unas esquinas transparentes se les recortarían en negro.
const targets = [
  { file: 'public/favicon.png', size: 32, rx: 10.5, alpha: true },
  { file: 'public/gimnasia.png', size: 512, rx: 10.5, alpha: true },
  { file: 'public/apple-touch-icon.png', size: 180, rx: 0, alpha: false },
  { file: 'public/icon-192x192.png', size: 192, rx: 0, alpha: false },
  { file: 'public/icon-512x512.png', size: 512, rx: 0, alpha: false },
  { file: 'public/pwa-192x192.png', size: 192, rx: 0, alpha: false },
  { file: 'public/pwa-512x512.png', size: 512, rx: 0, alpha: false },
  // iOS exige el AppIcon sin canal alfa
  { file: 'ios-custom/AppIcon-1024.png', size: 1024, rx: 0, alpha: false },
];

for (const { file, size, rx, alpha } of targets) {
  // El SVG ya declara width/height: librsvg rasteriza a ese tamaño de forma nativa.
  let img = sharp(svg(size, rx));
  if (!alpha) img = img.flatten({ background: MINT });
  await img.png({ compressionLevel: 9 }).toFile(resolve(root, file));
  const meta = await sharp(resolve(root, file)).metadata();
  console.log(`  ✓ ${file.padEnd(30)} ${meta.width}x${meta.height}  alpha=${meta.hasAlpha}`);
}

console.log('✅ PNG del logo regenerados.');
