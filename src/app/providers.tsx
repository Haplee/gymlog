import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import type { ReactNode } from 'react';
import { queryClient } from './queryClient';
import { isNative, registerNativeNotificationListeners } from '@shared/lib/notifications';
import '@shared/lib/i18n';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    if (!isNative()) return;

    void registerNativeNotificationListeners();

    void (async () => {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide();
    })();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-center"
        closeButton
        duration={3500}
        theme="dark"
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
    </QueryClientProvider>
  );
}
