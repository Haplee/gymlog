import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { inject } from '@vercel/analytics';
import { devLog, devWarn } from '@shared/lib/devtools';
import './index.css';
import App from './App.tsx';
import { Providers } from './app/providers.tsx';

inject();

// Registro SW con prompt de actualización (vite-plugin-pwa registerType='prompt')
if ('serviceWorker' in navigator) {
  // Solo se avisa una vez por carga; evita el toast en bucle.
  let updatePrompted = false;
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (updatePrompted) return;
            updatePrompted = true;
            devLog('[SW] New version available, prompting user...');
            window.dispatchEvent(
              new CustomEvent('sw-update-available', {
                detail: async () => {
                  devLog('[SW] User accepted update, skipping...');
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
    .catch((err: unknown) => devWarn('[SW] Register failed:', err));
}

// Sentry (crash/error tracking) — privacy-first, solo si hay DSN configurado.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  void import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      sendDefaultPii: false, // no enviar PII
    });
  });
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
