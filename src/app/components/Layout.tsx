import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/stores/authStore';
import { queryClient } from '@app/queryClient';
import { fetchWorkoutsAndSets, fetchWorkouts, fetchRecentSets } from '@shared/api/queries';
import { motion, AnimatePresence } from 'framer-motion';
import { Dumbbell, BarChart3, History, Settings, Heart, WifiOff } from 'lucide-react';

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

  const tabs = [
    { path: '/', Icon: Dumbbell, label: t('workout.title'), id: 'train' },
    { path: '/cardio', Icon: Heart, label: 'Cardio', id: 'cardio' },
    { path: '/stats', Icon: BarChart3, label: t('stats.title'), id: 'stats' },
    { path: '/history', Icon: History, label: t('history.title'), id: 'history' },
    { path: '/settings', Icon: Settings, label: t('settings.title'), id: 'settings' },
  ];

  useEffect(() => {
    if (user?.id) {
      preloadChunk(location.pathname);
    }
  }, [location.pathname, user?.id]);

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <header
        className="px-4 py-3 flex-shrink-0"
        style={{
          backgroundColor: 'rgba(17,17,17,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-glass)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #c8ff00 0%, #a0cc00 100%)',
                boxShadow: '0 2px 8px rgba(200,255,0,0.3)',
              }}
            >
              <Dumbbell className="w-4 h-4" style={{ color: '#000' }} />
            </div>
            <div
              className="text-[1rem] font-bold leading-none tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Gym<span style={{ color: 'var(--interactive-primary)' }}>Log</span>
            </div>
          </div>
          {user && (
            <div
              className="flex items-center gap-2 px-2.5 py-1 rounded-[var(--radius-pill)]"
              style={{
                backgroundColor: 'var(--bg-surface-2)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--success)', boxShadow: '0 0 6px var(--success)' }}
              />
              <span
                className="text-[0.6875rem] font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {user.email?.split('@')[0]}
              </span>
            </div>
          )}
        </div>
      </header>

      <nav
        className="flex flex-shrink-0 relative z-10"
        style={{
          backgroundColor: 'rgba(0,0,0,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-glass)',
          boxShadow: '0 -1px 0 rgba(255,255,255,0.04)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const { Icon, label } = tab;
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
              <div className="relative">
                <Icon
                  className="w-5 h-5"
                  strokeWidth={isActive ? 2 : 1.5}
                  style={{
                    color: isActive ? 'var(--interactive-primary)' : 'var(--text-tertiary)',
                  }}
                />
                {isActive && (
                  <motion.div
                    layoutId="activeTabDot"
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{
                      backgroundColor: 'var(--interactive-primary)',
                      boxShadow: 'var(--glow-accent)',
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span
                className="text-[0.5625rem] font-semibold tracking-wide"
                style={{ color: isActive ? 'var(--interactive-primary)' : 'var(--text-tertiary)' }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <AnimatePresence>
        {!isOnline && (
          <motion.div
            key="offline-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-center gap-2 py-2 px-4 offline-pulse flex-shrink-0"
            style={{
              backgroundColor: 'rgba(255,69,58,0.12)',
              borderBottom: '1px solid rgba(255,69,58,0.25)',
            }}
          >
            <WifiOff className="w-3.5 h-3.5" style={{ color: 'var(--error)' }} />
            <span className="text-[0.75rem] font-medium" style={{ color: 'var(--error)' }}>
              Sin conexión — los cambios se guardarán al reconectar
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ type: 'spring' as const, stiffness: 250, damping: 25 }}
          className="flex-1 px-4 pt-4 pb-24 overflow-y-auto"
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
