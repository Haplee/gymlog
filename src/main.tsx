import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { inject } from '@vercel/analytics';
import { devLog } from '@shared/lib/devtools';
import './index.css';
import App from './App.tsx';
import { Providers } from './app/providers.tsx';

inject();

// El SW se registra automáticamente via vite-plugin-pwa (registerType='prompt')
// que emite 'sw-update-available' cuando hay nueva versión.
devLog('[PWA] vite-plugin-pwa gestiona el registro del SW');

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
