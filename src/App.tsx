import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LazyMotion } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { PermissionRequests } from '@app/components/PermissionRequests';
import { PageSkeleton } from '@shared/components/ui/Skeleton';
import { OnboardingModal } from '@features/auth/components/OnboardingModal';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '@shared/lib/supabase';
import { useWorkoutReminder } from '@features/routine/hooks/useWorkoutReminder';
import { useFatigueSuggestion } from '@features/stats/hooks/useFatigueSuggestion';
import { useBackgroundNotifications } from '@shared/hooks/useBackgroundNotifications';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { devLog, devError } from '@shared/lib/devtools';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';

const loadMotionFeatures = () => import('@shared/lib/motionFeatures').then((mod) => mod.default);

const AuthPage = lazy(() =>
  import('@features/auth/pages/AuthPage').then((m) => ({ default: m.AuthPage })),
);
const AuthCallback = lazy(() => import('@features/auth/pages/AuthCallback'));
const WorkoutPage = lazy(() =>
  import('@features/workout/pages/WorkoutPage').then((m) => ({ default: m.WorkoutPage })),
);
const StatsPage = lazy(() =>
  import('@features/stats/pages/StatsPage').then((m) => ({ default: m.StatsPage })),
);
const HistoryPage = lazy(() =>
  import('@features/stats/pages/HistoryPage').then((m) => ({ default: m.HistoryPage })),
);
const SettingsPage = lazy(() =>
  import('@features/auth/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const RoutinePage = lazy(() =>
  import('@features/routine/pages/RoutinePage').then((m) => ({ default: m.RoutinePage })),
);
const CardioPage = lazy(() =>
  import('@features/cardio/pages/CardioPage').then((m) => ({ default: m.CardioPage })),
);
const UserStatsPage = lazy(() =>
  import('@features/stats/pages/UserStatsPage').then((m) => ({ default: m.UserStatsPage })),
);
const ExerciseLibraryPage = lazy(() =>
  import('@features/workout/pages/ExerciseLibraryPage').then((m) => ({
    default: m.ExerciseLibraryPage,
  })),
);

function Loading() {
  return (
    <div className="min-h-dvh bg-base bg-base">
      <PageSkeleton />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();
  const { user } = useAuthStore();

  // La transición de página vive en Layout (m.main). Animar aquí también
  // duplicaba exit+enter (dos mode="wait" encadenados) y hacía lento el cambio de tab.
  return (
    <Routes location={location}>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <WorkoutPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/routines"
        element={
          <ProtectedRoute>
            <RoutinePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stats"
        element={
          <ProtectedRoute>
            <StatsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cardio"
        element={
          <ProtectedRoute>
            <CardioPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/user-stats"
        element={
          <ProtectedRoute>
            <UserStatsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exercises"
        element={
          <ProtectedRoute>
            <ExerciseLibraryPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Hook para manejar actualizaciones de la PWA */
function usePWAUpdate() {
  useEffect(() => {
    let updateFn: (() => Promise<void>) | null = null;

    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<() => Promise<void>>;
      if (customEvent.detail) {
        updateFn = customEvent.detail;
        toast.info('Nueva versión disponible', {
          description: 'Actualiza para disfrutar de las últimas mejoras.',
          duration: 8000,
          action: {
            label: 'Actualizar',
            onClick: async () => {
              try {
                if (updateFn) {
                  await updateFn();
                  window.location.reload();
                }
              } catch (err) {
                toast.error('Error al actualizar');
                devError('Update failed:', err);
              }
            },
          },
        });
      }
    };

    window.addEventListener('sw-update-available', handler);
    return () => {
      window.removeEventListener('sw-update-available', handler);
      updateFn = null;
    };
  }, []);
}

function AppRoutes() {
  const { user, loading, initialized } = useAuthStore();
  const { applyTheme } = useSettingsStore();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navigate = useNavigate();

  useWorkoutReminder();
  useFatigueSuggestion();
  useBackgroundNotifications();
  usePWAUpdate();

  // Inicializar tema al arrancar
  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  // Manejar Deep Links (OAuth Google, etc)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    CapApp.addListener('appUrlOpen', (data) => {
      if (import.meta.env.DEV) devLog('[DeepLink] Received:', data.url);
      const url = new URL(data.url);

      if (import.meta.env.DEV) {
        devLog(
          '[DeepLink] protocol:',
          url.protocol,
          'host:',
          url.hostname,
          'path:',
          url.pathname,
          'hash:',
          url.hash.substring(0, 50),
        );
      }

      // 1. Manejar Shortcuts (com.franvi.gymlog://...)
      if (url.protocol === 'com.franvi.gymlog:') {
        if (import.meta.env.DEV) devLog('[DeepLink] Custom protocol, host:', url.hostname);
        if (url.hostname === 'workout' && url.pathname === '/new') {
          navigate('/', { replace: true });
          return;
        }
        if (url.hostname === 'history') {
          navigate('/history', { replace: true });
          return;
        }
      }

      // 2. Manejar Auth Callback - puede venir como hostname 'auth' o path '/auth/callback'
      const isAuthCallback = url.hostname === 'auth' || url.pathname.includes('/auth/callback');
      if (isAuthCallback && url.hash) {
        if (import.meta.env.DEV) devLog('[DeepLink] Auth callback detected, processing hash...');
        const params = url.hash.replace('#', '?');
        const urlParams = new URLSearchParams(params);
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');
        if (import.meta.env.DEV)
          devLog('[DeepLink] accessToken:', accessToken ? 'present' : 'MISSING');

        if (accessToken && refreshToken) {
          supabase.auth
            .setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            .then(({ error }) => {
              if (!error && import.meta.env.DEV) devLog('[Auth] Sesión establecida vía Deep Link');
              else if (error && import.meta.env.DEV) devError('[Auth] Error setSession:', error);
            });
        }
      }
    });

    return () => {
      CapApp.removeAllListeners();
    };
  }, [navigate]);

  useEffect(() => {
    if (!initialized) {
      useAuthStore.getState().init();
    }
  }, [initialized]);

  useEffect(() => {
    if (initialized && user) {
      const checkProfile = async () => {
        const { data } = await supabase.from('profiles').select('goal').eq('id', user.id).single();
        if (data && !data.goal) {
          setShowOnboarding(true);
        }
      };
      checkProfile();
    }
  }, [initialized, user]);

  if (!initialized || loading) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      {showOnboarding && user && (
        <OnboardingModal user={user} onComplete={() => setShowOnboarding(false)} />
      )}
      <AnimatedRoutes />
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LazyMotion features={loadMotionFeatures}>
        <BrowserRouter>
          <PermissionRequests />
          <AppRoutes />
        </BrowserRouter>
      </LazyMotion>
    </ErrorBoundary>
  );
}
