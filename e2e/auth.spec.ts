import { test, expect } from '@playwright/test';

test('Debe cargar la página de login inicialmente', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/.*login/);
  // Verificar acceso
  const title = page.locator('h1', { hasText: 'GymLog' });
  await expect(title).toBeVisible();
});

test('Formulario de login cambia entre iniciar sesión y registro', async ({ page }) => {
  await page.goto('/login');

  // Por defecto es inicio de sesión
  const btnSubmit = page.locator('button[type="submit"]');
  await expect(btnSubmit).toHaveText('Entrar');

  // Cambiar a registro
  const toggleBtn = page.locator('button', { hasText: '¿Sin cuenta? Crea una' });
  await toggleBtn.click();

  await expect(btnSubmit).toHaveText('Crear cuenta');
  await expect(page.locator('input[placeholder="Nombre completo"]')).toBeVisible();
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

  // Debería bloquearlo
  await expect(btnSubmit).toHaveText(/Espera \d+s/);
  await expect(btnSubmit).toBeDisabled();
});
