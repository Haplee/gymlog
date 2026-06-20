import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { useCardioStore } from '@features/cardio/stores/cardioStore';
import { queryClient } from '@app/queryClient';
import { fetchWorkoutsAndSets, fetchWorkouts, fetchRecentSets } from '@shared/api/queries';
import { m, AnimatePresence } from 'framer-motion';
import { Dumbbell, BarChart3, History, Settings, Heart, WifiOff, RefreshCw } from 'lucide-react';
import { useOutboxStore } from '@shared/stores/outboxStore';

interface LayoutProps {
  children: ReactNode;
}

const prefetchPageData = (path: string, userId: string) => {
  if (path === '/') {
    queryClient.prefetchQuery({
      queryKey: ['recentSets', userId],
      queryFn: () => fetchRecentSets(userId),
    });
  } else if (path === '/stats') {
    queryClient.prefetchQuery({
      queryKey: ['workoutsAndSets', userId],
      queryFn: () => fetchWorkoutsAndSets(userId),
    });
  } else if (path === '/history') {
    queryClient.prefetchQuery({
      queryKey: ['workouts', userId],
      queryFn: () => fetchWorkouts(userId),
    });
  }
};

const preloadChunk = (path: string) => {
  if (path === '/') {
    import('@features/workout/pages/WorkoutPage');
  } else if (path === '/cardio') {
    import('@features/cardio/pages/CardioPage');
  } else if (path === '/stats') {
    import('@features/stats/pages/StatsPage');
  } else if (path === '/history') {
    import('@features/stats/pages/HistoryPage');
  } else if (path === '/settings') {
    import('@features/auth/pages/SettingsPage');
  }
};

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function Layout({ children }: LayoutProps) {
  const { user } = useAuthStore();
  const location = useLocation();
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const workoutSets = useWorkoutStore((s) => s.sets);
  const workoutStartedAt = useWorkoutStore((s) => s.startedAt);
  const cardioActive = useCardioStore((s) => s.isActive);
  const pendingSync = useOutboxStore((s) => s.pending);
  const trainBadge = !!workoutStartedAt && workoutSets.length > 0;

  const tabs = [
    { path: '/', Icon: Dumbbell, label: t('workout.title'), id: 'train', badge: trainBadge },
    { path: '/cardio', Icon: Heart, label: 'Cardio', id: 'cardio', badge: cardioActive },
    { path: '/stats', Icon: BarChart3, label: t('stats.title'), id: 'stats', badge: false },
    { path: '/history', Icon: History, label: t('history.title'), id: 'history', badge: false },
    { path: '/settings', Icon: Settings, label: t('settings.title'), id: 'settings', badge: false },
  ];

  useEffect(() => {
    if (user?.id) {
      preloadChunk(location.pathname);
    }
  }, [location.pathname, user?.id]);

  // Precargar el resto de chunks en idle: el primer tap a cada tab ya no espera red
  useEffect(() => {
    if (!user?.id) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    const handle = idle(() => {
      ['/', '/cardio', '/stats', '/history', '/settings'].forEach(preloadChunk);
    });
    return () => {
      (window.cancelIdleCallback ?? window.clearTimeout)(handle as number);
    };
  }, [user?.id]);

  return (
    <div className="h-screen h-[100dvh] flex flex-col overflow-hidden bg-base">
      <header
        className="px-4 pb-3 flex-shrink-0 bg-surface border-b border-line"
        style={{ paddingTop: 'calc(var(--inset-top, env(safe-area-inset-top)) + 0.75rem)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center bg-gradient-to-br from-accent to-accent-dim shadow-btn-accent">
              <Dumbbell className="w-4 h-4 text-accent-fg" />
            </div>
            <div className="text-lg font-bold leading-none tracking-tight text-fg">
              Gym<span className="text-accent">Log</span>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-pill bg-surface-2 border border-line">
              <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
              <span className="text-xs font-medium text-fg-muted">{user.email?.split('@')[0]}</span>
            </div>
          )}
        </div>
      </header>

      <nav className="flex flex-shrink-0 relative z-10 bg-base">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const { Icon, label, badge } = tab;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              onPointerEnter={() => {
                if (user?.id) {
                  prefetchPageData(tab.path, user.id);
                  preloadChunk(tab.path);
                }
              }}
              className="flex-1 py-3 flex flex-col items-center gap-1 relative transition-opacity active:opacity-60"
            >
              <div className="relative px-3.5 py-0.5">
                {isActive && (
                  <m.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 rounded-pill bg-accent/12"
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  />
                )}
                <Icon
                  className={`relative w-5 h-5 transition-colors ${isActive ? 'text-accent' : 'text-fg-subtle'}`}
                  strokeWidth={isActive ? 2 : 1.5}
                />
                {badge && (
                  <m.span
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -top-1 right-2 w-2 h-2 rounded-full bg-accent shadow-glow pulse-soft"
                  />
                )}
              </div>
              <span
                className={`text-[0.5625rem] font-semibold tracking-wide transition-colors ${isActive ? 'text-accent' : 'text-fg-subtle'}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <AnimatePresence>
        {!isOnline && (
          <m.div
            key="offline-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-center gap-2 py-2 px-4 offline-pulse flex-shrink-0 bg-error/12 border-b border-error/25"
          >
            <WifiOff className="w-3.5 h-3.5 text-error" />
            <span className="text-xs font-medium text-error">{t('common.offline')}</span>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingSync > 0 && (
          <m.div
            key="pending-sync"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-center gap-2 py-1.5 px-4 flex-shrink-0 bg-accent/10 border-b border-line-accent"
          >
            <RefreshCw className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-medium text-accent">
              {pendingSync === 1
                ? t('workout.pending_sync_one')
                : t('workout.pending_sync_other', { count: pendingSync })}
            </span>
          </m.div>
        )}
      </AnimatePresence>

      {/* El scroller es un <main> plano: framer-motion dejaba estilos inline
          (will-change/transform) en él, lo que rompe position:sticky de sus
          descendientes (barra de filtros del historial). La transición de página
          vive en un wrapper interno (solo opacidad, sin transform). */}
      <main className="flex-1 min-h-0 px-4 pt-4 pb-24 overflow-y-auto">
        <m.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          {children}
        </m.div>
      </main>
    </div>
  );
}
