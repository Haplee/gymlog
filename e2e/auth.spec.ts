import { test, expect } from '@playwright/test';

// El modal de pre-permiso de notificaciones (PermissionRequests) se muestra
// cuando Notification.permission === 'default' (WebKit móvil) e intercepta
// clicks. Se siembra el flag para que no aparezca en e2e.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gymlog_permissions_seen', 'true');
  });
});

test('Debe cargar la página de login inicialmente', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/.*login/);
  // Wordmark del rediseño Stitch
  await expect(page.getByRole('heading', { name: 'GYMLOG' })).toBeVisible();
});

test('Formulario de login cambia entre iniciar sesión y registro', async ({ page }) => {
  await page.goto('/login');

  // Por defecto es inicio de sesión
  const btnSubmit = page.locator('button[type="submit"]');
  await expect(btnSubmit).toHaveText(/iniciar sesión|login/i);

  // Cambiar a registro
  await page.getByRole('button', { name: /crea una|create one/i }).click();

  await expect(btnSubmit).toHaveText(/registrarse|sign up/i);
  await expect(page.getByLabel(/nombre completo|full name/i)).toBeVisible();
});

test('Rate limit muestra error después de demasiados intentos fallidos', async ({ page }) => {
  await page.goto('/login');

  // Rellenar con credenciales inválidas para desencadenar spam
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'pass1234');

  const btnSubmit = page.locator('button[type="submit"]');

  // Playwright es muy rápido, hacemos 5 clicks.
  for (let i = 0; i < 5; i++) {
    await btnSubmit.click();
    await page.waitForTimeout(100);
  }

  // Debería bloquearlo. El patrón acepta los dos idiomas: la app arranca en
  // español («Espera 30 s») y este test solo esperaba el inglés, así que fallaba
  // siempre en local. Con el espacio opcional porque cada idioma lo pone donde
  // le toca.
  await expect(btnSubmit).toHaveText(/(Wait|Espera)\s*\d+\s*s/i);
  await expect(btnSubmit).toBeDisabled();
});
