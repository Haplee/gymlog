import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import { PermissionRequests } from './components/PermissionRequests';

const AuthPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const WorkoutPage = lazy(() => import('./pages/WorkoutPage').then(m => ({ default: m.WorkoutPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const RoutinePage = lazy(() => import('./pages/RoutinePage').then(m => ({ default: m.RoutinePage })));

function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
      <div className="text-[#c8ff00] fade-in">Cargando...</div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

const pageVariants = {
  initial: { opacity: 0, scale: 0.98 },
  in: { opacity: 1, scale: 1 },
  out: { opacity: 0, scale: 1.02 }
};

const pageTransition: Transition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.3
};

function AnimatedRoutes() {
  const location = useLocation();
  const { user } = useAuthStore();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={
          <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}>
            {user ? <Navigate to="/" replace /> : <AuthPage />}
          </motion.div>
        } />
        <Route path="/auth/callback" element={
          <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}>
            <AuthCallback />
          </motion.div>
        } />
        <Route path="/" element={
          <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}>
            <ProtectedRoute><WorkoutPage /></ProtectedRoute>
          </motion.div>
        } />
        <Route path="/routines" element={
          <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}>
            <ProtectedRoute><RoutinePage /></ProtectedRoute>
          </motion.div>
        } />
        <Route path="/stats" element={
          <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}>
            <ProtectedRoute><StatsPage /></ProtectedRoute>
          </motion.div>
        } />
        <Route path="/history" element={
          <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}>
            <ProtectedRoute><HistoryPage /></ProtectedRoute>
          </motion.div>
        } />
        <Route path="/settings" element={
          <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}>
            <ProtectedRoute><SettingsPage /></ProtectedRoute>
          </motion.div>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function AppRoutes() {
  const { loading, initialized } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
      useAuthStore.getState().init();
    }
  }, [initialized]);

  if (!initialized || loading) {
    return <Loading />;
  }

  return (
    <Suspense fallback={<Loading />}>
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
