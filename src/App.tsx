import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router';
import { LazyMotion, AnimatePresence, MotionConfig } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { AppLockGate } from '@features/auth/components/AppLockGate';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { PermissionRequests } from '@app/components/PermissionRequests';
import { PageSkeleton } from '@shared/components/ui';
import { OnboardingModal } from '@features/auth/components/OnboardingModal';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '@shared/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { flushWorkoutOutbox } from '@shared/lib/workoutOutbox';
import { useOutboxStore } from '@shared/stores/outboxStore';
import { updateWidget } from '@shared/lib/widget';
import { fetchWorkouts } from '@shared/api/queries';
import { calculateCurrentStreak } from '@features/stats/utils/kpiCalculations';
import { getAccentPreset } from '@shared/constants/accents';
import { useWorkoutReminder } from '@features/routine/hooks/useWorkoutReminder';
import { useFatigueSuggestion } from '@features/stats/hooks/useFatigueSuggestion';
import { getRoutineReminderDays } from '@features/routine/lib/routineReminders';
import { useBackgroundNotifications } from '@shared/hooks/useBackgroundNotifications';
import { useCapacitorListener } from '@shared/hooks/useCapacitorListener';
import { Capacitor } from '@capacitor/core';
import { initPredictiveBack, syncBackState } from '@shared/lib/backHandler';
import { devLog, devError } from '@shared/lib/devtools';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';
import { track } from '@vercel/analytics';

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
// La sección del entrenador se inyecta en Ajustes desde aquí: `auth` no debe
// importar de `coach` —cerraba una dependencia circular— pero esta capa sí
// puede conocer a las dos. Sigue siendo `lazy` para no arrastrar el store del
// coach al bundle de entrada.
const CoachSettingsSection = lazy(() =>
  import('@features/coach/components/CoachSettingsSection').then((m) => ({
    default: m.CoachSettingsSection,
  })),
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
const WearablesPage = lazy(() =>
  import('@features/wearables/pages/WearablesPage').then((m) => ({ default: m.WearablesPage })),
);
const NotificationsPage = lazy(() =>
  import('@features/auth/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const GuidePage = lazy(() =>
  import('@features/guide/pages/GuidePage').then((m) => ({ default: m.GuidePage })),
);
const CoachPage = lazy(() =>
  import('@features/coach/pages/CoachPage').then((m) => ({ default: m.CoachPage })),
);
const CoachMemoryPage = lazy(() =>
  import('@features/coach/pages/CoachMemoryPage').then((m) => ({ default: m.CoachMemoryPage })),
);
const FitBodyShowcasePage = lazy(() =>
  import('@features/fitbody/pages/FitBodyShowcasePage').then((m) => ({
    default: m.FitBodyShowcasePage,
  })),
);

function Loading() {
  return (
    <div className="min-h-dvh bg-canvas bg-canvas">
      <PageSkeleton />
    </div>
  );
}

/**
 * Telemetría de navegación (P2).
 *
 * Solo web y solo producción, igual que el resto de la analítica del arranque
 * (main.tsx): dentro del APK cada beacon despierta la radio del móvil sin medir
 * nada útil. Envía un evento `page_view` con la ruta para poder reconstruir qué
 * pantallas se usan y dónde se abandona el flujo. Sin PII: la ruta, y nada más.
 */
function usePageTracking() {
  const location = useLocation();
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (import.meta.env.DEV) return;
    track('page_view', { path: location.pathname });
  }, [location.pathname]);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

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
            <SettingsPage coachSection={<CoachSettingsSection />} />
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
      <Route
        path="/wearables"
        element={
          <ProtectedRoute>
            <WearablesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guide"
        element={
          <ProtectedRoute>
            <GuidePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coach"
        element={
          <ProtectedRoute>
            <CoachPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coach/memory"
        element={
          <ProtectedRoute>
            <CoachMemoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fitbody"
        element={
          <ProtectedRoute>
            <FitBodyShowcasePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Sincroniza la cola offline de entrenos al arrancar y al recuperar conexión. */
function useWorkoutOutboxSync() {
  const queryClient = useQueryClient();
  const refresh = useOutboxStore((s) => s.refresh);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const flushed = await flushWorkoutOutbox();
      if (cancelled) return;
      if (flushed > 0) {
        queryClient.invalidateQueries({ queryKey: ['workouts'], refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ['recentSets'], refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ['workoutsAndSets'], refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ['personalRecords'], refetchType: 'all' });
      }
      void refresh();
    };
    void refresh();
    void sync();
    const onOnline = () => void sync();
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
    };
  }, [queryClient, refresh]);
}

/** Mantiene el widget Android (racha + último entreno) al día. No-op en web/iOS. */
function useWidgetSync() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const accentColor = useSettingsStore((s) => s.accentColor);
  useEffect(() => {
    if (!user?.id || !Capacitor.isNativePlatform()) return;
    let cancelled = false;
    const sync = async () => {
      try {
        // Por la caché, no por la red. Antes esto pedía 400 entrenos en cada
        // `visibilitychange`, saltándose TanStack y el persister: volver a la
        // app costaba una petición completa solo para pintar una racha.
        // Compartiendo clave con la query que ya alimentan Layout e Historial,
        // dentro del `staleTime` no viaja nada.
        const workouts = await queryClient.fetchQuery({
          queryKey: ['workouts', user.id],
          queryFn: () => fetchWorkouts(user.id),
          staleTime: 1000 * 60 * 5,
        });
        if (cancelled) return;
        const streak = calculateCurrentStreak(workouts);
        const last = workouts[0];
        const names = last
          ? [...new Set(last.sets.flatMap((s) => (s.exercise?.name ? [s.exercise.name] : [])))]
          : [];
        // El widget vive sobre fondo oscuro: usamos el preset oscuro del acento.
        const preset = getAccentPreset(accentColor).dark;
        await updateWidget(streak, names.slice(0, 2).join(', '), preset.primary, preset.fg);
      } catch (err) {
        // El widget es accesorio: que falle no puede tumbar la app. Pero
        // tragarse el error dejaba sin rastro un fallo de red o del plugin.
        devError('[useWidgetSync]', err);
      }
    };
    void sync();
    const onVis = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [user?.id, accentColor, queryClient]);
}

function AppRoutes() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initialized = useAuthStore((s) => s.initialized);
  // Selector fino: suscribirse al store entero re-renderizaba TODO el árbol de
  // rutas en cada cambio de cualquier ajuste (sonido, descanso, unidades…).
  const applyTheme = useSettingsStore((s) => s.applyTheme);
  const guideSeen = useSettingsStore((s) => s.guideSeen);
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Bloqueo biométrico: solo nativo y solo si el usuario lo activó. Arranca
  // bloqueado y se re-bloquea al volver del segundo plano (ver efecto abajo).
  const isNative = Capacitor.isNativePlatform();
  const [locked, setLocked] = useState(() => {
    if (!isNative || !useSettingsStore.getState().biometricEnabled) return false;
    // Tras desbloquear, el plugin nativo recarga el WebView (única forma fiable
    // de repintar la superficie tras el prompt) y deja esta marca de un solo uso.
    // Si es reciente, arrancamos desbloqueados para no volver a pedir biometría.
    const ts = Number(localStorage.getItem('applock_unlocked_at') ?? 0);
    localStorage.removeItem('applock_unlocked_at');
    return Date.now() - ts >= 10000;
  });
  const navigate = useNavigate();
  const location = useLocation();

  usePageTracking();
  useWorkoutReminder();
  useFatigueSuggestion();
  useBackgroundNotifications(user?.id ?? null, getRoutineReminderDays);
  useWorkoutOutboxSync();
  useWidgetSync();

  // Inicializar tema al arrancar
  useEffect(() => {
    applyTheme();
    // Si el usuario eligió «Sistema», sincroniza el modo claro/oscuro del
    // sistema (valor inicial + cambios en caliente). Idempotente por sesión.
    if (useSettingsStore.getState().theme === 'system') {
      useSettingsStore.getState().initSystemThemeSync();
    }
  }, [applyTheme]);

  // Predictive back (Android): el atrás cierra overlays, retrocede en el router
  // o, en la raíz, deja que el sistema anime la salida y cierre la app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const dispose = initPredictiveBack();
    return dispose;
  }, []);

  // Cada navegación re-sincroniza el handler nativo con el historial real.
  useEffect(() => {
    syncBackState();
  }, [location.key]);

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

  // Re-bloquear al pasar a segundo plano, para que al volver pida biometría.
  // Listener propio (no comparte con el de appUrlOpen) para no arrastrar su
  // removeAllListeners.
  useCapacitorListener(
    'appStateChange',
    ({ isActive }) => {
      if (!isActive && useSettingsStore.getState().biometricEnabled) setLocked(true);
    },
    isNative,
  );

  useEffect(() => {
    if (initialized && user) {
      const checkProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('goal')
          .eq('id', user.id)
          .maybeSingle();
        // Sin fila de perfil (usuario antiguo) o sin goal → onboarding.
        if (!error && (!data || !data.goal)) {
          setShowOnboarding(true);
        }
      };
      checkProfile();
    }
  }, [initialized, user]);

  if (!initialized || loading) return <Loading />;

  return (
    <>
      <Suspense fallback={<Loading />}>
        {showOnboarding && user && (
          <OnboardingModal
            user={user}
            onComplete={() => {
              setShowOnboarding(false);
              // Solo tras crear el perfil: una cuenta ya existente no ve la guía
              // al entrar, la tiene en Ajustes cuando le apetezca.
              if (!guideSeen) navigate('/guide');
            }}
          />
        )}
        <AnimatedRoutes />
      </Suspense>
      <AnimatePresence>
        {isNative && biometricEnabled && user && locked && (
          <AppLockGate key="applock" onUnlock={() => setLocked(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      {/* `reducedMotion="user"` respeta prefers-reduced-motion en TODAS las
          animaciones de framer-motion: los dos bloques @media de index.css no
          las alcanzan porque framer anima estilos inline por JS, no por CSS.
          Además es el interruptor de ahorro de energía que no existe de otra
          forma: el modo de batería de Android activa prefers-reduced-motion en
          el WebView, así que con esto las animaciones se apagan solas. Framer
          conserva las transiciones de opacidad (que no marean) y descarta las de
          transform, que son las que cuestan GPU. */}
      <MotionConfig reducedMotion="user">
        <LazyMotion features={loadMotionFeatures}>
          <BrowserRouter>
            <PermissionRequests />
            <AppRoutes />
          </BrowserRouter>
        </LazyMotion>
      </MotionConfig>
    </ErrorBoundary>
  );
}
