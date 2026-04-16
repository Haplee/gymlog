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

    // StatusBar y SplashScreen solo en nativo
    void (async () => {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide();
      // Delegamos el manejo de la StatusBar al código nativo en MainActivity.java
    })();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-center"
        richColors
        closeButton
        duration={3500}
        toastOptions={{
          style: {
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          },
        }}
      />
    </QueryClientProvider>
  );
}
