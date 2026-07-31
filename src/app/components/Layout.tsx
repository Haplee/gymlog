import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { useCardioStore } from '@features/cardio/stores/cardioStore';
import { queryClient } from '@app/queryClient';
import { fetchWorkoutsAndSets, fetchWorkouts, fetchRecentSets } from '@shared/api/queries';
import { m, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';
import {
  IconHome,
  IconDumbbell,
  IconPulse,
  IconChart,
  IconGear,
  IconMenu,
  IconUser,
} from '@shared/components/icons';
import { AppDrawer } from '@app/components/AppDrawer';
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
  const user = useAuthStore((s) => s.user);
  const { displayName } = useProfile();
  const location = useLocation();
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const workoutSets = useWorkoutStore((s) => s.sets);
  const workoutStartedAt = useWorkoutStore((s) => s.startedAt);
  const cardioActive = useCardioStore((s) => s.isActive);
  const pendingSync = useOutboxStore((s) => s.pending);
  const trainBadge = !!workoutStartedAt && workoutSets.length > 0;
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const unreadCount = useNotificationsStore(selectUnreadCount);
  // Sincroniza con Health Connect/HealthKit al abrir la app (Layout envuelve
  // toda página autenticada), no solo al entrar en Ajustes > Wearables.
  useWearableSync();

  // Las cinco pestañas de la referencia visual (`public/screens/*.png`).
  // Historial ya no tiene pestaña propia: STATS ocupa su sitio y el acceso a
  // `/history` vive en el cajón, junto al resto de lo que desplaza el rediseño.
  const tabs = [
    { path: '/', Icon: IconHome, label: t('nav.home'), badge: trainBadge },
    { path: '/routines', Icon: IconDumbbell, label: t('nav.routines'), badge: false },
    { path: '/cardio', Icon: IconPulse, label: t('nav.cardio'), badge: cardioActive },
    { path: '/stats', Icon: IconChart, label: t('nav.stats'), badge: false },
    { path: '/settings', Icon: IconGear, label: t('nav.settings'), badge: false },
  ];

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

      <AnimatePresence>
        {menuOpen && (
          <AppDrawer
            onClose={() => setMenuOpen(false)}
            onOpenSearch={() => {
              setMenuOpen(false);
              setSearchOpen(true);
            }}
            unreadCount={unreadCount}
          />
        )}
      </AnimatePresence>

      {/* Cabecera de la referencia visual: hamburguesa, wordmark centrado y
          usuario. El punto sobre la hamburguesa hereda el aviso de no leídas que
          antes llevaba la campana, ahora dentro del cajón. */}
      <header
        className="px-2 flex-shrink-0 bg-canvas border-b border-line"
        style={{ paddingTop: 'var(--inset-top, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center" style={{ height: 'var(--header-height)' }}>
          {user ? (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t('nav.menu')}
              className="relative flex h-11 w-11 items-center justify-center text-fg active:opacity-60"
            >
              <IconMenu className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />
              )}
            </button>
          ) : (
            <span className="h-11 w-11" />
          )}

          <span className="flex-1 text-center font-display text-lg font-bold tracking-tight text-fg">
            GYM<span className="text-accent">LOG</span>
          </span>

          {user ? (
            <Link
              to="/settings"
              aria-label={displayName}
              className="flex h-11 w-11 items-center justify-center text-fg active:opacity-60"
            >
              <IconUser className="h-6 w-6" />
            </Link>
          ) : (
            <span className="h-11 w-11" />
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

      {/* Barra inferior de la referencia visual: fondo del lienzo, filete
          superior, icono + rótulo por pestaña y una barrita de acento sobre la
          activa. Se mantiene la altura y el safe-area de siempre. */}
      <nav
        className="flex flex-shrink-0 relative z-10 bg-canvas border-t border-line"
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
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-1 relative transition-opacity active:opacity-60"
            >
              {isActive && (
                <m.div
                  layoutId="activeTabBar"
                  className="absolute top-0 h-0.5 w-7 rounded-pill bg-accent"
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                />
              )}
              <span className="relative">
                <Icon
                  className={`h-5 w-5 transition-colors ${
                    isActive ? 'text-accent' : 'text-fg-subtle'
                  }`}
                />
                {badge && (
                  <m.span
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-error"
                  />
                )}
              </span>
              <span
                className={`label-caps transition-colors ${
                  isActive ? 'text-accent' : 'text-fg-subtle'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
