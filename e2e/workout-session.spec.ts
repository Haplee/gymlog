import { test, expect, type Page } from '@playwright/test';

/**
 * Camino feliz con sesión iniciada: entrar → elegir ejercicio → anotar una serie
 * → guardar → verla en el historial.
 *
 * El resto de la suite solo visita rutas deslogueado y comprueba que redirigen a
 * login, así que **todo lo que hay detrás del login no tenía cobertura**: la
 * barra inferior, el editor grande de KG/REPS y el guardado se verificaban solo
 * a ojo en el emulador.
 *
 * Necesita credenciales de una cuenta de pruebas en `E2E_EMAIL` / `E2E_PASSWORD`
 * (por ejemplo en `.env.local`, que no se commitea). Sin ellas el bloque se
 * salta en vez de fallar: así CI sigue en verde sin secretos, y quien los tenga
 * configurados obtiene la cobertura de verdad.
 *
 * Usa una cuenta desechable, no la tuya: el test escribe un entreno real.
 */
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

/** Nombre irrepetible para poder localizar y limpiar lo que crea este test. */
const EXERCISE = `E2E Test ${Date.now()}`;

async function login(page: Page) {
  // El describe se salta sin credenciales, así que aquí ya están.
  await page.goto('/login');
  await page.fill('input[type="email"]', EMAIL ?? '');
  await page.fill('input[type="password"]', PASSWORD ?? '');
  await page.locator('button[type="submit"]').click();
  // El login redirige a la pantalla de entrenar.
  await expect(page).toHaveURL(/\/$|\/#\/$/, { timeout: 15000 });
}

/**
 * Crea y selecciona un ejercicio propio. El selector no ofrece «crear X» dentro
 * del resultado de búsqueda: es un botón fijo al pie de la lista que abre un
 * formulario con su propio campo de nombre.
 */
async function pickExercise(page: Page) {
  await page.getByPlaceholder(/buscar ejercicio/i).click();
  await page.getByRole('button', { name: /crear ejercicio personalizado/i }).click();
  await page.getByPlaceholder(/nombre del ejercicio/i).fill(EXERCISE);
  await page.getByRole('button', { name: /^crear$/i }).click();
  // Al crearlo queda seleccionado y aparece el editor de la serie 1.
  await expect(page.getByLabel(/^kg 1$/i)).toBeVisible({ timeout: 15000 });
}

test.describe('Sesión de entrenamiento (autenticado)', () => {
  test.skip(
    !EMAIL || !PASSWORD,
    'Define E2E_EMAIL y E2E_PASSWORD para ejecutar el flujo autenticado.',
  );

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('gymlog_permissions_seen', 'true');
    });
  });

  test('la barra inferior lleva a las cinco pestañas', async ({ page }) => {
    await login(page);

    // Los rótulos son los del rediseño; si alguien renombra una pestaña sin
    // tocar la ruta, esto lo caza.
    for (const [name, path] of [
      ['Rutinas', '/routines'],
      ['Cardio', '/cardio'],
      ['Stats', '/stats'],
      ['Ajustes', '/settings'],
      ['Inicio', '/'],
    ] as const) {
      await page.getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path}`));
    }
  });

  test('el menú no repite destinos de la barra inferior', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: /menú|menu/i }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    // Ajustes vive en la barra y en el icono de usuario: en el cajón sobra.
    await expect(drawer.getByRole('link', { name: 'Ajustes', exact: true })).toHaveCount(0);
    await expect(drawer.getByRole('link', { name: /historial/i })).toBeVisible();
  });

  test('anota una serie y la guarda', async ({ page }) => {
    await login(page);

    // Ejercicio nuevo por nombre libre: no depende del catálogo de la cuenta.
    await pickExercise(page);

    // El editor grande de la maqueta: KG y REPS con etiqueta encima.
    const kg = page.getByLabel(/^kg 1$/i);
    const reps = page.getByLabel(/^reps 1$/i);
    await expect(kg).toBeVisible();

    await kg.fill('60');
    await reps.fill('8');

    await page.getByRole('button', { name: /guardar/i }).click();

    // El guardado limpia la sesión y enseña el resumen.
    await expect(page.getByText(/60/).first()).toBeVisible({ timeout: 15000 });
  });

  test('la valoración no ocupa la pantalla hasta que se pide', async ({ page }) => {
    await login(page);
    await pickExercise(page);

    // En reposo no hay ni estrellas ni cuadro de texto de sesión.
    await expect(page.getByPlaceholder(/cómo te has sentido/i)).toHaveCount(0);

    await page.getByRole('button', { name: /valorar sesión/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByPlaceholder(/cómo te has sentido/i)).toBeVisible();
  });
});
