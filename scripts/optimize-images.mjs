import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

const PUBLIC_DIR = './public';

async function optimizeImages() {
  const images = [
    { name: 'apple-touch-icon.png', quality: 80 },
    { name: 'icon-192x192.png', quality: 80 },
    { name: 'icon-512x512.png', quality: 80 },
    { name: 'pwa-192x192.png', quality: 80 },
    { name: 'pwa-512x512.png', quality: 80 },
    { name: 'gimnasia.png', quality: 85 },
  ];

  for (const img of images) {
    const inputPath = path.join(PUBLIC_DIR, img.name);
    const outputPath = path.join(PUBLIC_DIR, img.name.replace('.png', '.webp'));

    try {
      await fs.access(inputPath);
      const meta = await fs.stat(inputPath);
      const originalSize = meta.size;

      await sharp(inputPath)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: img.quality, effort: 4 })
        .toFile(outputPath);

      const newMeta = await fs.stat(outputPath);
      const savings = ((originalSize - newMeta.size) / originalSize * 100).toFixed(1);

      console.log(`✓ ${img.name}: ${(originalSize / 1024).toFixed(1)}KB → ${(newMeta.size / 1024).toFixed(1)}KB (${savings}% smaller)`);
    } catch (e) {
      console.log(`✗ ${img.name}: ${e.message}`);
    }
  }
}

optimizeImages();