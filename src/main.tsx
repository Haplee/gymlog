import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { inject } from '@vercel/analytics';
import { onCLS, onFID, onLCP, onTTFB, onFCP } from 'web-vitals';
import './index.css';
import App from './App.tsx';
import { Providers } from './app/providers.tsx';

inject();

if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  onLCP((m) => console.log('[LCP]', m.value));
  // eslint-disable-next-line no-console
  onFCP((m) => console.log('[FCP]', m.value));
  // eslint-disable-next-line no-console
  onTTFB((m) => console.log('[TTFB]', m.value));
  // eslint-disable-next-line no-console
  onCLS((m) => console.log('[CLS]', m.value));
  // eslint-disable-next-line no-console
  onFID((m) => console.log('[FID]', m.value));
}

// Registro SW con prompt de actualización (vite-plugin-pwa registerType='prompt')
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New version available, prompting user...');
            window.dispatchEvent(
              new CustomEvent('sw-update-available', {
                detail: async () => {
                  console.log('[SW] User accepted update, skipping...');
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  await new Promise((r) => setTimeout(r, 500));
                  window.location.reload();
                },
              }),
            );
          }
        });
      });
    })
    .catch((err: unknown) => console.warn('[SW] Register failed:', err));
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
