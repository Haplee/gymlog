import path from 'path';

/**
 * Fuente única de los alias de import para Vite y Vitest.
 * (tsconfig.app.json los declara aparte porque usa el resolver de TypeScript,
 * no el de bundler — mantener ambos sincronizados si se añade uno nuevo.)
 */
export const aliases: Record<string, string> = {
  '@': path.resolve(__dirname, './src'),
  '@features': path.resolve(__dirname, './src/features'),
  '@shared': path.resolve(__dirname, './src/shared'),
  '@app': path.resolve(__dirname, './src/app'),
};
