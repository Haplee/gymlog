import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import type { ReactNode } from 'react';
import { queryClient } from './queryClient';
import { idbPersister } from './queryPersister';
import { PersistGate } from './persistGate';
import { isNative, initNotifications } from '@shared/lib/notifications';
import { useSettingsStore } from '@shared/stores/settingsStore';
import '@shared/lib/i18n';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    if (!isNative()) return;

    void initNotifications();

    void (async () => {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide();
    })();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PersistGate client={queryClient} persister={idbPersister} maxAge={1000 * 60 * 60 * 24}>
        {children}
        <Toaster
          position="bottom-center"
          closeButton
          duration={3500}
          theme={theme}
          toastOptions={{
            style: {
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              padding: '12px 16px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              marginBottom: 'calc(env(safe-area-inset-bottom) + 80px)',
            },
          }}
        />
      </PersistGate>
    </QueryClientProvider>
  );
}
