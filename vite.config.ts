import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const sbUrl = env.VITE_SUPABASE_URL;
  const sbKey = env.VITE_SUPABASE_KEY;

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@features': path.resolve(__dirname, './src/features'),
        '@shared': path.resolve(__dirname, './src/shared'),
        '@app': path.resolve(__dirname, './src/app'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            recharts: ['recharts'],
            supabase: ['@supabase/supabase-js'],
            // framer-motion sin manualChunk: con LazyMotion, Rollup separa el core (m)
            // de las features (domMax), que cargan async vía motionFeatures.ts
            query: ['@tanstack/react-query'],
            confetti: ['canvas-confetti'],
          },
        },
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(sbUrl),
      'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify(sbKey),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.ico', 'apple-touch-icon.webp', 'masked-icon.svg'],
        // Manifest único (antes existía public/manifest.json duplicado que lo eclipsaba)
        manifest: {
          name: 'GymLog',
          short_name: 'GymLog',
          description: 'Tu diario de entrenamiento de fuerza',
          lang: 'es',
          theme_color: '#080808',
          background_color: '#080808',
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
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
          importScripts: ['sw-custom.js'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api',
                networkTimeoutSeconds: 10,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 },
              },
            },
            {
              urlPattern: /\.(js|css|png|svg|ico|woff2)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-assets',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: /\.html$/i,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'html-cache' },
            },
          ],
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
    ].filter(Boolean) as unknown as Plugin[],
  };
});
