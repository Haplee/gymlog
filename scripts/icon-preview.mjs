// Harness temporal: screenshot de los iconos de músculo para verificación visual
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 760 } });
await page.goto('file://' + path.join(dir, 'icon-preview.html'));
await page.screenshot({ path: path.join(dir, 'icon-preview.png') });
await browser.close();
console.log('OK -> scripts/icon-preview.png');
