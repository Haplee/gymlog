import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { PermissionRequests } from '@app/components/PermissionRequests';
import { PageSkeleton } from '@shared/components/ui/Skeleton';
import { OnboardingModal } from '@features/auth/components/OnboardingModal';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '@shared/lib/supabase';
import { useWorkoutReminder } from '@features/routine/hooks/useWorkoutReminder';
import { useBackgroundNotifications } from '@shared/hooks/useBackgroundNotifications';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

function handleAuthCallback(url: string) {
  console.log('[DeepLink] URL recibida:', url);
  const urlObj = new URL(url);

  // 1. Manejar Shortcuts (com.franvi.gymlog://...)
  if (urlObj.protocol === 'com.franvi.gymlog:') {
    if (urlObj.hostname === 'workout' && urlObj.pathname === '/new') {
      window.location.hash = '/';
      return;
    }
    if (urlObj.hostname === 'history') {
      window.location.hash = '/history';
      return;
    }
  }

  // 2. Manejar Auth Callback - varios formatos
  console.log('[DeepLink] pathname:', urlObj.pathname, 'hash:', urlObj.hash);

  // Formato 1: com.franvi.gymlog://auth/callback#access_token=xxx
  // Formato 2: https://eoltmipoklizewxdpzfa.supabase.co/auth/v1/callback#access_token=xxx
  let params: URLSearchParams;

  if (urlObj.hash && urlObj.hash.includes('access_token')) {
    params = new URLSearchParams(urlObj.hash.replace('#', '?'));
  } else if (urlObj.search && urlObj.search.includes('access_token')) {
    params = urlObj.searchParams;
  } else {
    console.log('[DeepLink] No se encontraron tokens en la URL');
    return;
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  console.log('[DeepLink] Tokens:', { accessToken: !!accessToken, refreshToken: !!refreshToken });

  if (accessToken && refreshToken) {
    supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      .then(({ error }) => {
        if (!error) {
          console.log('[Auth] Sesión establecida vía Deep Link');
        } else {
          console.error('[Auth] Error estableciendo sesión:', error);
        }
      });
  }
}

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

function Loading() {
  return (
    <div className="min-h-dvh bg-[--bg-base]">
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

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -8 },
};

const pageTransition: Transition = {
  type: 'tween',
  ease: [0.25, 0.1, 0.25, 1],
  duration: 0.2,
};

function AnimatedRoutes() {
  const location = useLocation();
  const { user } = useAuthStore();

  return (
    <AnimatePresence mode="sync">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/login"
          element={
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              {user ? <Navigate to="/" replace /> : <AuthPage />}
            </motion.div>
          }
        />
        <Route
          path="/auth/callback"
          element={
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              <AuthCallback />
            </motion.div>
          }
        />
        <Route
          path="/"
          element={
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              <ProtectedRoute>
                <WorkoutPage />
              </ProtectedRoute>
            </motion.div>
          }
        />
        <Route
          path="/routines"
          element={
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              <ProtectedRoute>
                <RoutinePage />
              </ProtectedRoute>
            </motion.div>
          }
        />
        <Route
          path="/stats"
          element={
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              <ProtectedRoute>
                <StatsPage />
              </ProtectedRoute>
            </motion.div>
          }
        />
        <Route
          path="/history"
          element={
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            </motion.div>
          }
        />
        <Route
          path="/settings"
          element={
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            </motion.div>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

/** Hook para manejar actualizaciones de la PWA vía Toasts */
function usePWAUpdate() {
  useEffect(() => {
    const handler = (e: Event) => {
      const updateFn = (e as CustomEvent<() => Promise<void>>).detail;
      toast.info('Nueva versión disponible', {
        description: 'Actualiza para disfrutar de las últimas mejoras.',
        duration: Infinity,
        action: {
          label: 'Actualizar',
          onClick: () => void updateFn(),
        },
      });
    };
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);
}

function AppRoutes() {
  const { user, loading, initialized } = useAuthStore();
  const { applyTheme } = useSettingsStore();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useWorkoutReminder();
  useBackgroundNotifications();
  usePWAUpdate();

  // Inicializar tema al arrancar
  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  // Manejar Deep Links (OAuth Google, etc)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Escuchar cuando la app se abre con una URL
    CapApp.addListener('appUrlOpen', (data) => {
      console.log('[DeepLink] URL recibida:', data.url);
      handleAuthCallback(data.url);
    });

    // También verificar cuando la app vuelve al foreground
    CapApp.addListener('appStateChange', (state) => {
      if (state.isActive) {
        console.log('[AppState] App стала активной, verificando sesión...');
        // Forzar verificación de sesión
        useAuthStore.getState().init();
      }
    });

    return () => {
      CapApp.removeAllListeners();
    };
  }, []);

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
    <BrowserRouter>
      <PermissionRequests />
      <AppRoutes />
    </BrowserRouter>
  );
}
