import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { inject } from '@vercel/analytics';
import { devLog, devError } from '@shared/lib/devtools';
import './index.css';
import App from './App.tsx';
import { Providers } from './app/providers.tsx';

inject();

/**
 * Service worker: solo en web.
 *
 * En Capacitor los assets se sirven desde el propio APK, así que el SW no aporta
 * offline y sí causaba un fallo real: tras instalar una versión nueva, seguía
 * sirviendo el bundle anterior desde caché. Además de no registrarlo, hay que
 * **desregistrar** el que ya tengan los que actualizan desde una versión previa,
 * o seguirían viendo la app vieja indefinidamente.
 */
if (Capacitor.isNativePlatform()) {
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker
      .getRegistrations()
      .then(async (regs) => {
        await Promise.all(regs.map((r) => r.unregister()));
        if (regs.length > 0) {
          // El SW viejo ya respondió a esta carga: sus cachés siguen ahí hasta
          // que las borremos.
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
          devLog('[PWA] SW nativo desregistrado y cachés limpiadas');
        }
      })
      .catch((e) => devError('[PWA] Error desregistrando el SW:', e));
  }
} else {
  void import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch((e) => devError('[PWA] Error registrando el SW:', e));

  // Cloudflare Web Analytics — solo en web, no tiene sentido dentro del APK.
  const cfToken = import.meta.env.VITE_CLOUDFLARE_ANALYTICS_TOKEN;
  if (cfToken) {
    const script = document.createElement('script');
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    script.setAttribute('data-cf-beacon', JSON.stringify({ token: cfToken }));
    script.defer = true;
    document.head.appendChild(script);
  }
}

// Sentry (crash/error tracking) — privacy-first, solo si hay DSN configurado.
// @sentry/capacitor envuelve @sentry/react para capturar también crashes nativos
// en Android/iOS, no solo errores de la webview.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  void Promise.all([import('@sentry/capacitor'), import('@sentry/react')]).then(
    ([Sentry, SentryReact]) => {
      Sentry.init(
        {
          dsn: sentryDsn,
          environment: import.meta.env.MODE,
          integrations: [Sentry.browserTracingIntegration()],
          tracesSampleRate: 0.1,
          sendDefaultPii: false, // no enviar PII
        },
        SentryReact.init,
      );
    },
  );
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
