import { defineConfig } from 'vitest/config';
import { aliases } from './vite.aliases';

export default defineConfig({
  test: {
    exclude: ['**/e2e/**', '**/node_modules/**', '**/dist/**'],
    alias: aliases,
  },
});
