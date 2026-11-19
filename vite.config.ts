import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { aliases } from './vite.aliases';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isE2e = mode === 'e2e';
  const sbUrl = isE2e ? 'http://localhost:54321' : env.VITE_SUPABASE_URL;
  const sbKey = isE2e ? 'e2e-anon-key' : env.VITE_SUPABASE_KEY;
  const sentryAuthToken = isE2e
    ? undefined
    : Object.prototype.hasOwnProperty.call(process.env, 'SENTRY_AUTH_TOKEN')
      ? process.env.SENTRY_AUTH_TOKEN?.trim() || undefined
      : env.SENTRY_AUTH_TOKEN?.trim() || undefined;

  return {
    resolve: {
      alias: aliases,
    },
    build: {
      // Los mapas solo se generan cuando hay token para subirlos. Sin token,
      // Vercel podría servir los .map y exponer el código fuente sin minificar.
      sourcemap: Boolean(sentryAuthToken),
      rollupOptions: {
        output: {
          manualChunks: {
            recharts: ['recharts'],
            supabase: ['@supabase/supabase-js'],
            // framer-motion sin manualChunk: con LazyMotion, Rollup separa el core (m)
            // de las features (domMax), que cargan async vía motionFeatures.ts
            query: ['@tanstack/react-query'],
            excel: ['exceljs'],
          },
        },
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(sbUrl),
      'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify(sbKey),
      'import.meta.env.VITE_E2E_MOCKS': JSON.stringify(isE2e ? 'true' : 'false'),
      'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(isE2e ? '' : env.VITE_SENTRY_DSN),
      'import.meta.env.VITE_CLOUDFLARE_ANALYTICS_TOKEN': JSON.stringify(
        isE2e ? '' : env.VITE_CLOUDFLARE_ANALYTICS_TOKEN,
      ),
      __APP_VERSION__: JSON.stringify(pkg.version),
      // Poda el código de depuración de Sentry, que es lo que arrastra el
      // bundle `dev/` de @sentry/browser — y con él la integración Spotlight,
      // una herramienta de desarrollo que no se referencia desde src/ ni desde
      // esta config. __SENTRY_TRACING__ se deja como está: el tracing sí se usa.
      __SENTRY_DEBUG__: JSON.stringify(false),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        disable: isE2e,
        registerType: 'autoUpdate',
        // El registro lo hace main.tsx a mano: en Capacitor los assets ya son
        // ficheros locales, así que el SW no aporta nada offline y sí servía
        // JS viejo tras actualizar el APK. En web sigue registrándose igual.
        injectRegister: null,
        includeAssets: ['favicon.ico', 'apple-touch-icon.webp', 'masked-icon.svg'],
        // Manifest único (antes existía public/manifest.json duplicado que lo eclipsaba)
        manifest: {
          name: 'GymLog',
          short_name: 'GymLog',
          description: 'Tu diario de entrenamiento de fuerza',
          lang: 'es',
          theme_color: '#0a0a0b',
          background_color: '#0a0a0b',
          display: 'standalone',
          orientation: 'portrait',
          categories: ['fitness', 'health', 'sports'],
          shortcuts: [
            {
              name: 'Nuevo Entrenamiento',
              short_name: 'Entrenar',
              description: 'Iniciar nuevo entrenamiento',
              url: '/',
              icons: [{ src: 'icon-192x192.webp', sizes: '192x192', type: 'image/webp' }],
            },
          ],
          icons: [
            {
              src: 'icon-192x192.webp',
              sizes: '192x192',
              type: 'image/webp',
            },
            {
              src: 'icon-512x512.webp',
              sizes: '512x512',
              type: 'image/webp',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          sourcemap: false,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
          importScripts: ['sw-custom.js'],
          // Sin runtimeCaching, ni para la API ni para el shell.
          //
          // Había un NetworkFirst sobre `https://*.supabase.co/*` con 60 s de
          // caché. Era una fuga entre cuentas: los entrenos y medidas de una
          // sesión podían servirse desde el service worker a la siguiente, y
          // ningún borrado al cerrar sesión alcanza a una respuesta que ya está
          // en vuelo. La app ya tiene su propia copia offline (TanStack Query +
          // IndexedDB) y la cola de guardado; el SW solo precachea el shell.
          //
          // Para js/css/html/fuentes tampoco: `globPatterns` ya los precachea
          // con revisión. Había un CacheFirst de 30 días sobre ellos y un
          // StaleWhileRevalidate del html que ensombrecían el precache y podían
          // servir un index.html viejo (apuntando a chunks viejos) tras
          // publicar una versión.
          runtimeCaching: [],
        },
        devOptions: {
          // SW desactivado en dev: con HMR se regenera constantemente y dispara
          // el toast de "nueva versión" en bucle.
          enabled: false,
          type: 'module',
        },
      }),
      mode === 'analyze' &&
        visualizer({
          filename: 'dist/bundle-report.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
        }),
      // Sube source maps a Sentry solo si hay token (no bloquea builds locales/CI sin él).
      sentryAuthToken &&
        sentryVitePlugin({
          org: 'franvi',
          project: 'capacitor',
          authToken: sentryAuthToken,
          sourcemaps: {
            // Sin esto, los .map quedan en dist/ y Vercel los serviría en
            // público — cualquiera podría descargar el código fuente sin minificar.
            filesToDeleteAfterUpload: ['dist/**/*.js.map'],
          },
        }),
    ].filter(Boolean) as unknown as Plugin[],
  };
});
