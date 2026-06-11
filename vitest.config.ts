import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/e2e/**', '**/node_modules/**', '**/dist/**'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@app': path.resolve(__dirname, './src/app'),
    },
  },
});
