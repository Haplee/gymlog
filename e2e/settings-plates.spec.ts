import { test, expect, E2E_CREDENTIALS } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Los discos del gimnasio se configuran una vez y se olvidan, pero durante un
 * tiempo el único sitio donde se podían tocar era un bloque plegado *dentro* de
 * la calculadora de discos, que a su vez solo se abre desde un entreno. Nadie lo
 * encontraba. Este test fija el contrato: el apartado está en Ajustes, se ve sin
 * desplegar nada, y lo que marcas ahí sobrevive a una recarga.
 *
 * Necesita `E2E_EMAIL` / `E2E_PASSWORD` (p. ej. en `.env.local`, fuera de git).
 * Sin ellas se salta, para que CI siga en verde sin secretos.
 */
const EMAIL = E2E_CREDENTIALS.email;
const PASSWORD = E2E_CREDENTIALS.password;

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', EMAIL ?? '');
  await page.fill('input[type="password"]', PASSWORD ?? '');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/$|\/#\/$/, { timeout: 15000 });
}

test.describe('Discos del gimnasio', () => {
  test('se configuran desde Ajustes y la selección persiste', async ({ page }) => {
    await login(page);
    await page.goto('/settings');

    const discos = page.getByRole('group', { name: /discos de mi gimnasio/i });
    await discos.scrollIntoViewIfNeeded();
    await expect(discos).toBeVisible();

    // Los 12 discos habituales, y los de la selección por defecto marcados.
    await expect(discos.getByRole('button')).toHaveCount(12);
    const disco25 = discos.getByRole('button', { name: '25', exact: true });
    await expect(disco25).toHaveAttribute('aria-pressed', 'true');

    // Quitarlo y comprobar que la app lo recuerda tras recargar: es la
    // diferencia entre un ajuste de verdad y un interruptor decorativo.
    await disco25.click();
    await expect(disco25).toHaveAttribute('aria-pressed', 'false');

    await page.reload();
    const disco25Tras = page
      .getByRole('group', { name: /discos de mi gimnasio/i })
      .getByRole('button', { name: '25', exact: true });
    await expect(disco25Tras).toHaveAttribute('aria-pressed', 'false');

    // Dejar la cuenta como estaba.
    await disco25Tras.click();
    await expect(disco25Tras).toHaveAttribute('aria-pressed', 'true');
  });
});
