import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/stores/authStore';
import { queryClient } from '@app/queryClient';
import { fetchWorkoutsAndSets, fetchWorkouts, fetchRecentSets } from '@shared/api/queries';
import { Dumbbell, BarChart3, History, Settings } from 'lucide-react';

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
    { path: '/stats', Icon: BarChart3, label: t('stats.title'), id: 'stats' },
    { path: '/history', Icon: History, label: t('history.title'), id: 'history' },
    { path: '/settings', Icon: Settings, label: t('settings.title'), id: 'settings' },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-[var(--bg-base)]">
      <header className="px-5 pb-3" style={{ paddingTop: '6px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
              <img src="/gimnasia.png" alt="Logo" className="w-9 h-9 object-contain" />
            </div>
            <div>
              <div className="text-[1.25rem] font-semibold text-[var(--text-primary)]">GymLog</div>
              {user && (
                <div className="text-[0.8125rem] text-[var(--text-tertiary)]">
                  {user.email?.split('@')[0]}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="flex px-4 gap-1 border-t border-[var(--border-subtle)]">
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
              <Icon
                className="w-5 h-5"
                strokeWidth={1.5}
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
              />
              <span
                className="text-[0.625rem] font-medium"
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
              >
                {label}
              </span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-[var(--interactive-primary)]" />
              )}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 px-4 pt-4 pb-8 overflow-y-auto">{children}</main>
    </div>
  );
}
