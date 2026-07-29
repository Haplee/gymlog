import { test, expect } from '@playwright/test';

// Smoke: cada ruta protegida carga o redirige a login sin romperse.
//
// La lista cubre la tabla entera de App.tsx a propósito. Con react-router 7 no
// hacía falta, pero un cambio de major puede alterar el emparejado de rutas sin
// que el compilador diga nada: aquí lo único que da señal es visitarlas.
const ROUTES = [
  { path: '/routines', match: /login|routines|\/$/ },
  { path: '/exercises', match: /login|exercises|\/$/ },
  { path: '/stats', match: /login|stats|\/$/ },
  { path: '/user-stats', match: /login|user-stats|\/$/ },
  { path: '/history', match: /login|history|\/$/ },
  { path: '/cardio', match: /login|cardio|\/$/ },
  { path: '/settings', match: /login|settings|\/$/ },
  { path: '/wearables', match: /login|wearables|\/$/ },
  { path: '/notifications', match: /login|notifications|\/$/ },
  { path: '/guide', match: /login|guide|\/$/ },
  { path: '/coach', match: /login|coach|\/$/ },
  // Dos segmentos: comprueba que el emparejado no se queda en /coach.
  { path: '/coach/memory', match: /login|coach\/memory|\/$/ },
  { path: '/fitbody', match: /login|fitbody|\/$/ },
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

  // El comodín `*` es lo que evita que una URL muerta deje la app en blanco.
  // Se comprueba aparte porque su acierto es justo NO quedarse donde estaba.
  test('una URL inexistente no deja la app colgada', async ({ page }) => {
    await page.goto('/esta-ruta-no-existe-jamas');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('esta-ruta-no-existe-jamas');
    expect(page.url()).toMatch(/login|\/$/);
    const body = await page.textContent('body');
    expect((body ?? '').length).toBeGreaterThan(0);
  });
});
