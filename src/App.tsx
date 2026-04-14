import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { PermissionRequests } from '@app/components/PermissionRequests';
import { PageSkeleton } from '@shared/components/ui/Skeleton';
import { OnboardingModal } from '@features/auth/components/OnboardingModal';
import { supabase } from '@shared/lib/supabase';
import './shared/lib/i18n';

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
  initial: { opacity: 0, scale: 0.98 },
  in: { opacity: 1, scale: 1 },
  out: { opacity: 0, scale: 1.02 },
};

const pageTransition: Transition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.3,
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

/** Banner de actualización PWA */
function UpdateBanner() {
  const [updateFn, setUpdateFn] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const fn = (e as CustomEvent<() => Promise<void>>).detail;
      setUpdateFn(() => fn);
    };
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  if (!updateFn) return null;

  return (
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-[--z-toast] flex items-center justify-between px-4 py-2.5"
      style={{
        background: 'var(--color-primary)',
        color: 'var(--text-inverse)',
      }}
    >
      <span className="text-[--text-sm] font-medium">Nueva versión disponible</span>
      <button
        onClick={() => void updateFn()}
        className="text-[--text-sm] font-semibold underline hover:no-underline"
      >
        Actualizar ahora
      </button>
    </div>
  );
}

function AppRoutes() {
  const { user, loading, initialized } = useAuthStore();
  const { applyTheme } = useSettingsStore();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Inicializar tema al arrancar
  useEffect(() => {
    applyTheme();
    // Reaccionar a cambios del sistema
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme();
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [applyTheme]);

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
      <UpdateBanner />
      <PermissionRequests />
      <AppRoutes />
    </BrowserRouter>
  );
}
