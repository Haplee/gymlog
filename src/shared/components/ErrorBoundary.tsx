import { Component, type ReactNode } from 'react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);

    // Sentry se carga aquí y no arriba a propósito. Este componente está en el
    // arranque (App.tsx lo monta sin `lazy`), así que un import estático metía
    // el SDK entero —unos 120 KB— en el bundle inicial de todo el mundo, y eso
    // anulaba la carga condicional por VITE_SENTRY_DSN que hace main.tsx.
    // Capturar un error es raro; arrancar la app es constante.
    void import('@sentry/react')
      .then((Sentry) => {
        Sentry.captureException(error, {
          extra: { componentStack: errorInfo.componentStack },
        });
      })
      .catch(() => {
        // Sin red o sin el chunk no hay reporte. No se hace nada más: el
        // usuario ya está viendo la pantalla de error.
      });

    toast.error('Algo salió mal');
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-canvas">
          <div className="text-center max-w-sm">
            <h1 className="text-xl font-bold text-error mb-2">Algo salió mal</h1>
            <p className="text-sm text-fg-muted mb-4">
              Lo sentimos, ha ocurrido un error inesperado.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-card bg-accent text-accent-fg font-medium"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
