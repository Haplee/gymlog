import { test as base, expect } from '@playwright/test';
import { DEFAULT_E2E_CREDENTIALS, E2E_STORAGE_KEYS } from './e2e-credentials';

export const E2E_CREDENTIALS = {
  email: process.env.E2E_EMAIL ?? DEFAULT_E2E_CREDENTIALS.email,
  password: process.env.E2E_PASSWORD ?? DEFAULT_E2E_CREDENTIALS.password,
};

export const test = base.extend({
  page: async ({ page }, apply) => {
    await page.addInitScript(
      ({ email, password, storageKeys }) => {
        try {
          localStorage.setItem(storageKeys.email, email);
          localStorage.setItem(storageKeys.password, password);
          localStorage.setItem(storageKeys.permissionsSeen, 'true');
        } catch {
          // A veces se ejecuta antes de que el documento tenga origen.
        }
      },
      {
        email: E2E_CREDENTIALS.email,
        password: E2E_CREDENTIALS.password,
        storageKeys: E2E_STORAGE_KEYS,
      },
    );
    await apply(page);
  },
});

export { expect };
