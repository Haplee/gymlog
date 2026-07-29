import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { useCardioStore } from '@features/cardio/stores/cardioStore';
import { queryClient } from '@app/queryClient';
import { fetchWorkoutsAndSets, fetchWorkouts, fetchRecentSets } from '@shared/api/queries';
import { m, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, Bell } from 'lucide-react';
import {
  IconHome,
  IconDumbbell,
  IconShoe,
  IconHistory,
  IconGear,
  IconSearch,
  IconUser,
} from '@shared/components/icons';
import { useOutboxStore } from '@shared/stores/outboxStore';
import { useProfile } from '@features/auth/hooks/useProfile';
import { useRestAlarm } from '@features/workout/hooks/useRestAlarm';
import { RestAlarmBanner } from '@features/workout/components/RestAlarmBanner';
import { ExerciseSearchSheet } from '@shared/components/ExerciseSearchSheet';
import { useNotificationsStore, selectUnreadCount } from '@shared/stores/notificationsStore';
import { useWearableSync } from '@features/wearables/hooks/useWearableSync';

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
  } else if (path === '/routines') {
    import('@features/routine/pages/RoutinePage');
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
  const { displayName, avatarUrl } = useProfile();
  const location = useLocation();
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const workoutSets = useWorkoutStore((s) => s.sets);
  const workoutStartedAt = useWorkoutStore((s) => s.startedAt);
  const cardioActive = useCardioStore((s) => s.isActive);
  const pendingSync = useOutboxStore((s) => s.pending);
  const trainBadge = !!workoutStartedAt && workoutSets.length > 0;
  const [searchOpen, setSearchOpen] = useState(false);
  const unreadCount = useNotificationsStore(selectUnreadCount);
  // Sincroniza con Health Connect/HealthKit al abrir la app (Layout envuelve
  // toda página autenticada), no solo al entrar en Ajustes > Wearables.
  useWearableSync();

  const tabs = [
    { path: '/', Icon: IconHome, label: t('nav.home'), id: 'home', badge: trainBadge },
    {
      path: '/routines',
      Icon: IconDumbbell,
      label: t('routine.title'),
      id: 'routines',
      badge: false,
    },
    { path: '/cardio', Icon: IconShoe, label: 'Cardio', id: 'cardio', badge: cardioActive },
    { path: '/history', Icon: IconHistory, label: t('history.title'), id: 'history', badge: false },
    {
      path: '/settings',
      Icon: IconGear,
      label: t('settings.title'),
      id: 'settings',
      badge: false,
    },
  ];

  // El kit rotula la pantalla en la cabecera en vez de usar un logo fijo.
  const TITLES: Record<string, string> = {
    '/': t('workout.title'),
    '/routines': t('routine.title'),
    '/cardio': 'Cardio',
    '/history': t('history.title'),
    '/settings': t('settings.title'),
    '/stats': t('stats.title'),
    '/user-stats': t('userStats.page_title'),
    '/exercises': t('library.title'),
    '/wearables': t('settings.wearables'),
    '/guide': t('guide.title'),
    '/notifications': t('notifications.title'),
  };
  const pageTitle = TITLES[location.pathname] ?? 'GYMLOG';

  // El descanso termina (y suena) aunque el usuario esté en otra pestaña.
  useRestAlarm();

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
      ['/', '/routines', '/cardio', '/stats', '/history', '/settings'].forEach(preloadChunk);
    });
    return () => {
      (window.cancelIdleCallback ?? window.clearTimeout)(handle as number);
    };
  }, [user?.id]);

  // `h-full` y no `h-[100dvh]`: en Android edge-to-edge el WebView ocupa la
  // pantalla entera, pero dvh devuelve el viewport SIN las barras del sistema y
  // la barra inferior quedaba flotando 232 px por encima del borde (medido en un
  // Pixel 9a). Ver el bloque de html/body/#root en index.css.
  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      <AnimatePresence>
        {searchOpen && <ExerciseSearchSheet onClose={() => setSearchOpen(false)} />}
      </AnimatePresence>

      {/* Cabecera estilo FitBody: título de la pantalla a la izquierda en el
          acento, acciones circulares a la derecha. Sin wordmark centrado. */}
      <header
        className="px-4 flex-shrink-0 bg-canvas"
        style={{ paddingTop: 'var(--inset-top, env(safe-area-inset-top))' }}
      >
        <div
          className="flex items-center justify-between gap-3"
          style={{ height: 'var(--header-height)' }}
        >
          <h1 className="font-display text-lg font-bold text-accent truncate">{pageTitle}</h1>
          {user && (
            <div className="flex items-center gap-2">
              {/* La lupa abre la búsqueda para entrenar, no la biblioteca:
                  si no, duplicaría el acceso que ya hay en Entrenar. */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label={t('search.placeholder')}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-surface border border-line text-fg-muted active:opacity-70"
              >
                <IconSearch className="h-4 w-4" />
              </button>
              {/* Campana con punto de no leídas, como la cabecera del kit. */}
              <Link
                to="/notifications"
                aria-label={t('notifications.title')}
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-surface border border-line text-fg-muted active:opacity-70"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
                )}
              </Link>
              <Link
                to="/settings"
                aria-label={displayName}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-accent text-accent-fg active:opacity-70"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    width={36}
                    height={36}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <IconUser className="h-4 w-4" />
                )}
              </Link>
            </div>
          )}
        </div>
      </header>

      <RestAlarmBanner />

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

      {/* Barra inferior del kit: rellena del color de acento, esquinas superiores
          muy redondeadas e iconos oscuros. El activo va en un círculo oscuro. */}
      <nav
        className="flex flex-shrink-0 relative z-10 bg-accent rounded-t-[20px]"
        style={{
          height:
            'calc(var(--bottom-nav-height) + var(--inset-bottom, env(safe-area-inset-bottom)))',
          paddingBottom: 'var(--inset-bottom, env(safe-area-inset-bottom))',
        }}
      >
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
              aria-label={label}
              className="flex-1 flex items-center justify-center relative transition-opacity active:opacity-60"
            >
              <div className="relative flex h-11 w-11 items-center justify-center">
                {isActive && (
                  <m.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 rounded-full bg-canvas"
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  />
                )}
                <Icon
                  className={`relative h-6 w-6 transition-colors ${
                    isActive ? 'text-accent' : 'text-accent-fg'
                  }`}
                />
                {badge && (
                  <m.span
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute right-1 top-1 h-2 w-2 rounded-full bg-error"
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
