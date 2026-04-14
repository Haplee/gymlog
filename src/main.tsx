import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { inject } from '@vercel/analytics';
import './index.css';
import App from './App.tsx';
import { Providers } from './app/providers.tsx';

inject();

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
            window.dispatchEvent(
              new CustomEvent('sw-update-available', {
                detail: () => {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
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
