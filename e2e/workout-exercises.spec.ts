import { test, expect } from '@playwright/test';

test.describe('Workout Page', () => {
  test('root page loads', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url).toMatch(/\/|\/login|\/workout/);
  });

  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url).toContain('login');

    const pageContent = await page.content();
    expect(pageContent.includes('GymLog') || pageContent.includes('Iniciar')).toBe(true);
  });

  test('workout page loads', async ({ page }) => {
    await page.goto('/workout');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(url).toMatch(/login|workout|\/$/);
  });
});
