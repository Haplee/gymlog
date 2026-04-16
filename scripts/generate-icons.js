#!/usr/bin/env node
/**
 * Genera los iconos de Android en todos los tamaños mipmap necesarios.
 * Fuente: public/icons/icon-512x512.png  (o public/gimnasia.png como fallback)
 * Uso: npm run icons  (solo tras npx cap add android)
 */
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Tamaños y directorios mipmap ordenados
const densities = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

// Fuente de icono (orden de preferencia)
const sources = [
  resolve(root, 'public/icons/icon-512x512.png'),
  resolve(root, 'public/gimnasia.png'),
];

const source = sources.find(existsSync);
if (!source) {
  console.error('❌ No se encontró icono fuente. Coloca icon-512x512.png en public/icons/');
  process.exit(1);
}

const androidRes = resolve(root, 'android/app/src/main/res');
if (!existsSync(androidRes)) {
  console.error('❌ No existe android/. Ejecuta primero: npx cap add android');
  process.exit(1);
}

console.log(`🎨 Generando iconos desde: ${source}`);

for (const { dir, size } of densities) {
  const outDir = resolve(androidRes, dir);
  mkdirSync(outDir, { recursive: true });

  // Icono Legado
  const outFile = resolve(outDir, 'ic_launcher.png');
  await sharp(source)
    .resize(size, size, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(outFile);

  // Icono Round
  const outFileRound = resolve(outDir, 'ic_launcher_round.png');
  await sharp(source)
    .resize(size, size, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(outFileRound);

  // Icono Adaptativo (Foreground) - Lo que realmente se ve en Android moderno
  // Zona segura: el icono debe estar en el 66% central. Subimos al 62% para que se vea grande y claro.
  const foregroundSize = Math.floor(size * 0.62); 
  const outFileForeground = resolve(outDir, 'ic_launcher_foreground.png');
  await sharp(source)
    .resize(foregroundSize, foregroundSize, { kernel: 'lanczos3' })
    .sharpen({ sigma: 1, m1: 2, m2: 20 }) // Enfoque más agresivo para máxima nitidez
    .extend({
      top: Math.floor((size - foregroundSize) / 2),
      bottom: Math.ceil((size - foregroundSize) / 2),
      left: Math.floor((size - foregroundSize) / 2),
      right: Math.ceil((size - foregroundSize) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(outFileForeground);

  console.log(`  ✓ ${dir}/${size}x${size} (Legacy + Round + Foreground)`);
}

console.log('✅ Iconos generados correctamente.');
