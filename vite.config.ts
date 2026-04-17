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
            motion: ['framer-motion'],
            query: ['@tanstack/react-query'],
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
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'GymLog PWA',
          short_name: 'GymLog',
          description: 'PWA de entrenamiento de gimnasio',
          theme_color: '#0a0a0c',
          background_color: '#0a0a0c',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
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
                expiration: { maxEntries: 50, maxAgeSeconds: 300 },
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
          enabled: true,
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
