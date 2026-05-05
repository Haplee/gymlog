import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/stores/authStore';
import { queryClient } from '@app/queryClient';
import { fetchWorkoutsAndSets, fetchWorkouts, fetchRecentSets } from '@shared/api/queries';
import { motion, AnimatePresence } from 'framer-motion';
import { Dumbbell, BarChart3, History, Settings, Heart } from 'lucide-react';

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

export function Layout({ children }: LayoutProps) {
  const { user } = useAuthStore();
  const location = useLocation();
  const { t } = useTranslation();

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
      <header className="px-4 py-3 flex-shrink-0" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--interactive-primary)' }}
            >
              <Dumbbell className="w-4 h-4" style={{ color: 'var(--interactive-primary-fg)' }} />
            </div>
            <div>
              <div
                className="text-[1rem] font-bold leading-none"
                style={{ color: 'var(--text-primary)' }}
              >
                Gym<span style={{ color: 'var(--interactive-primary)' }}>Log</span>
              </div>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--success)' }}
              />
              <span className="text-[0.75rem]" style={{ color: 'var(--text-tertiary)' }}>
                {user.email?.split('@')[0]}
              </span>
            </div>
          )}
        </div>
      </header>

      <nav
        className="flex flex-shrink-0 relative z-10"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
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
              className="flex-1 py-3 flex flex-col items-center gap-1 relative"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute top-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--interactive-primary)' }}
                  transition={{ type: 'spring' as const, stiffness: 500, damping: 30 }}
                />
              )}
              <Icon
                className="w-5 h-5"
                strokeWidth={isActive ? 2 : 1.5}
                style={{ color: isActive ? 'var(--interactive-primary)' : 'var(--text-tertiary)' }}
              />
              <span
                className="text-[0.625rem] font-medium"
                style={{ color: isActive ? 'var(--interactive-primary)' : 'var(--text-tertiary)' }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

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
