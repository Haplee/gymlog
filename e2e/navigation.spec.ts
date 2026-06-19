import { test, expect } from '@playwright/test';

// Smoke: cada ruta protegida carga o redirige a login sin romperse.
const ROUTES = [
  { path: '/routines', match: /login|routines|\/$/ },
  { path: '/exercises', match: /login|exercises|\/$/ },
  { path: '/user-stats', match: /login|user-stats|\/$/ },
  { path: '/cardio', match: /login|cardio|\/$/ },
  { path: '/settings', match: /login|settings|\/$/ },
];

test.describe('Navegación (smoke)', () => {
  for (const { path, match } of ROUTES) {
    test(`${path} carga o redirige`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(page.url()).toMatch(match);
      // No debe haber pantalla en blanco: hay contenido en el DOM.
      const body = await page.textContent('body');
      expect((body ?? '').length).toBeGreaterThan(0);
    });
  }
});
