import { defineConfig } from 'vitest/config';
import { aliases } from './vite.aliases';

/**
 * Las Edge Functions (`supabase/functions/`) corren en Deno e importan por URL
 * (`https://esm.sh/zod@3.24.2`). Vitest corre en Node: Vite deja los imports
 * http como externos y el runner acaba haciendo un `import()` nativo, que
 * revienta con «Only URLs with a scheme in: file and data are supported».
 *
 * Se reescribe el especificador en `transform` (con `enforce: 'pre'`, antes del
 * análisis de imports de Vite) en lugar de usar `resolve.alias`: los alias no
 * llegan a ver las URLs porque Vite las marca como externas antes.
 *
 * Solo afecta a los tests. El código desplegado conserva la URL, que es lo que
 * Deno necesita, y la versión del zod local (^3.24.2) es la misma que pide.
 */
const denoUrlImports = {
  name: 'gymlog:deno-url-imports',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.includes('supabase/functions')) return null;
    if (!code.includes('https://esm.sh/')) return null;
    return {
      code: code.replace(/["']https:\/\/esm\.sh\/(zod)@[\d.]+["']/g, "'$1'"),
      map: null,
    };
  },
};

export default defineConfig({
  plugins: [denoUrlImports],
  test: {
    exclude: ['**/e2e/**', '**/node_modules/**', '**/dist/**'],
    alias: aliases,
  },
});
