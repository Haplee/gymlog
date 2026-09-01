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
    /**
     * Valores de relleno para que la suite no dependa del `.env` de cada
     * máquina. Los tests que hablan con Supabase mockean el módulo, pero
     * `supabase.ts` construye el cliente al importarse y `createClient` exige
     * una URL válida: cualquier fichero que lo arrastre por la cadena de
     * imports reventaba con «supabaseUrl is required» donde no hubiera `.env`.
     * Apuntan a localhost a propósito: si un test se saltara el mock e hiciera
     * red de verdad, falla en vez de tocar un proyecto real.
     */
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_KEY: 'clave-de-test',
    },
  },
});
