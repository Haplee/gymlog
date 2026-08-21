import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import type { CSSProperties, ReactNode } from 'react';
import { queryClient } from './queryClient';
import { idbPersister } from './queryPersister';
import { PersistGate } from './persistGate';
import { isNative, initNotifications } from '@shared/lib/notifications';
import { useSettingsStore } from '@shared/stores/settingsStore';
import '@shared/lib/i18n';

/**
 * Hueco entre el aviso y el borde inferior: la barra de navegación más el área
 * segura del dispositivo. Se lee de los mismos tokens que usa el Layout, así que
 * si la barra cambia de alto los avisos la siguen sin tocar nada aquí.
 */
const TOAST_OFFSET = {
  bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + var(--space-3))',
};

/**
 * Variables propias de sonner apuntadas a los tokens del sistema.
 *
 * Van como estilo en línea y no en el CSS por una razón concreta: sonner
 * declara estas mismas variables en `[data-sonner-toaster][data-sonner-theme="dark"]`,
 * y esa regla (especificidad 0-2-0, inyectada en tiempo de ejecución) gana a
 * cualquier bloque razonable de la hoja de estilos. En línea se acaba la
 * discusión. Con esto el aspa de cerrar deja de ser un botón negro pegado a un
 * aviso claro.
 */
const TOAST_VARS = {
  '--normal-bg': 'var(--bg-surface-2)',
  '--normal-bg-hover': 'var(--bg-surface)',
  '--normal-border': 'var(--glass-edge)',
  '--normal-border-hover': 'var(--glass-edge-top)',
  '--normal-text': 'var(--text-secondary)',
} as CSSProperties;

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
        {/*
          Los avisos son chrome flotante: van por encima del contenido y de la
          barra inferior, así que les toca la capa 3 del material (`glass-3`) y
          no una tarjeta con estilos propios.

          El aspecto vive en `index.css` con clases, no aquí con `style`. Con
          estilos inline no había forma de que un aviso de error se distinguiera
          de uno de éxito (todos compartían el mismo objeto), ni de responder a
          `prefers-reduced-motion`, ni de usar los tokens de radio y sombra: se
          usaban 12px y una sombra negra a mano, justo lo que el sistema de
          diseño prohíbe en oscuro, donde un negro al 40% no se ve pero se pinta.

          `offset` sustituye al `marginBottom` que llevaba el estilo: el hueco es
          la barra inferior real más el área segura, no 80px inventados.
        */}
        <Toaster
          position="bottom-center"
          closeButton
          duration={3500}
          theme={theme}
          offset={TOAST_OFFSET}
          style={TOAST_VARS}
          mobileOffset={TOAST_OFFSET}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast: 'gl-toast glass-3',
              title: 'gl-toast__title',
              description: 'gl-toast__description',
              icon: 'gl-toast__icon',
              closeButton: 'gl-toast__close',
              actionButton: 'gl-toast__action',
              cancelButton: 'gl-toast__cancel',
              success: 'gl-toast--success',
              error: 'gl-toast--error',
              warning: 'gl-toast--warning',
              info: 'gl-toast--info',
            },
          }}
        />
      </PersistGate>
    </QueryClientProvider>
  );
}
