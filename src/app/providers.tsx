import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import type { ReactNode } from 'react';
import { queryClient } from './queryClient';
import '@shared/lib/i18n';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
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
