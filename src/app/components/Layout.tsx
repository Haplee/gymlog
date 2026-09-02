import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { queryClient } from '@app/queryClient';
import { fetchWorkoutsAndSets, fetchWorkouts, fetchRecentSets } from '@shared/api/queries';
import { m, AnimatePresence } from 'framer-motion';
import {
  IconDumbbell,
  IconFlame,
  IconHistory,
  IconChart,
  IconHome,
  IconMenu,
  IconPulse,
  Refresh,
  WifiOff,
} from '@shared/components/icons';
import { calculateCurrentStreak } from '@features/stats/utils/kpiCalculations';
import { AppDrawer } from '@app/components/AppDrawer';
import { useOutboxStore } from '@shared/stores/outboxStore';
import { useRestAlarm } from '@features/workout/hooks/useRestAlarm';
import { RestAlarmBanner } from '@features/workout/components/RestAlarmBanner';
import { ExerciseSearchSheet } from '@features/workout/components/ExerciseSearchSheet';
import { useNotificationsStore, selectUnreadCount } from '@shared/stores/notificationsStore';
import { useWearableSync } from '@features/wearables/hooks/useWearableSync';
import { registerBackAction } from '@shared/lib/backHandler';
import { useCardioStore } from '@features/cardio/stores/cardioStore';
import { useTrainingWakeLock } from '@app/hooks/useTrainingWakeLock';

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
  } else if (path === '/user-stats') {
    import('@features/stats/pages/UserStatsPage');
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
  const location = useLocation();
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const workoutSets = useWorkoutStore((s) => s.sets);
  const workoutStartedAt = useWorkoutStore((s) => s.startedAt);
  const pendingSync = useOutboxStore((s) => s.pending);
  const trainBadge = !!workoutStartedAt && workoutSets.length > 0;
  const cardioActive = useCardioStore((s) => s.isActive);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const unreadCount = useNotificationsStore(selectUnreadCount);
  // Sincroniza con Health Connect/HealthKit al abrir la app (Layout envuelve
  // toda página autenticada), no solo al entrar en Ajustes > Wearables.
  useWearableSync();
  // Pantalla encendida mientras se entrena. Se monta aquí, no en cada página,
  // para que sobreviva a navegar a mitad de sesión.
  useTrainingWakeLock();

  // Difuminado de borde de scroll: las tiras se encienden solo cuando hay
  // contenido que disolver por ese lado. Es lo que sustituye al backdrop-filter
  // —la señal de "hay algo pasando por debajo del chrome"— sin remuestrear el
  // fondo en cada frame.
  const scrollerRef = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const top = el.scrollTop > 4;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    // Solo re-renderiza cuando alguno de los dos cambia de verdad; si no, un
    // scroll largo dispararía un render por frame.
    setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, []);

  // useLayoutEffect y no useEffect: si la página nueva no llena la pantalla, la
  // tira de abajo se apagaría un frame tarde y se vería parpadear.
  useLayoutEffect(updateEdges, [updateEdges, location.pathname, children]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateEdges]);

  // El gesto de atrás (Android) cierra el drawer y la hoja de búsqueda antes de
  // intentar navegar. El registro vive en el estado de cada overlay: al abrirse
  // se registra, al cerrarse se da de baja (y se re-sincroniza el handler nativo).
  useEffect(() => {
    if (!searchOpen) return;
    return registerBackAction('layout-search', () => setSearchOpen(false));
  }, [searchOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    return registerBackAction('layout-drawer', () => setMenuOpen(false));
  }, [menuOpen]);

  // Racha para la cabecera. Comparte clave con la caché que ya alimenta
  // Historial (y que `prefetchPageData` precalienta), así que no añade una
  // petición propia salvo que nadie haya pedido los entrenos todavía.
  const { data: streakWorkouts = [] } = useQuery({
    queryKey: ['workouts', user?.id],
    queryFn: () => fetchWorkouts(user?.id ?? ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
  const streak = calculateCurrentStreak(streakWorkouts);

  // Cinco pestañas: lo que se usa a diario entrenando. El resto (ajustes,
  // biblioteca, entrenador, wearables…) vive en el cajón de la hamburguesa.
  //
  // «Progreso» entra en la barra porque detrás está lo único de la app sobre lo
  // que se puede actuar hoy —qué peso toca en la próxima sesión y si conviene
  // descargar— y estaba a dos toques, dentro de un menú, y luego a quince
  // secciones de scroll. Ese contenido ya abre la pantalla; esto le da la puerta.
  const tabs = [
    { path: '/', Icon: IconHome, label: t('nav.home'), badge: trainBadge },
    { path: '/routines', Icon: IconDumbbell, label: t('nav.routines'), badge: false },
    { path: '/user-stats', Icon: IconChart, label: t('nav.progress'), badge: false },
    { path: '/history', Icon: IconHistory, label: t('history.title'), badge: false },
    // El punto de «cardio en marcha» vivía en el cajón, de cuando cardio no
    // tenía pestaña propia. Ahora la tiene, así que el aviso va donde está el
    // destino y el cajón deja de duplicarlo.
    { path: '/cardio', Icon: IconPulse, label: t('nav.cardio'), badge: cardioActive },
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
      ['/', '/routines', '/cardio', '/user-stats', '/stats', '/history', '/settings'].forEach(
        preloadChunk,
      );
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
        className="glass-3 glass-flush glass-flush-b px-2 flex-shrink-0"
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

          {/* Racha en vez del acceso a Ajustes: el engranaje vive en el menú
              hamburguesa, así que ese hueco puede llevar el dato que la app
              quiere que mires. Sin racha viva no se enseña un cero
              desmotivador; se deja el sitio reservado para que el wordmark no
              se descentre. */}
          {user && streak > 0 ? (
            <Link
              to="/stats"
              aria-label={t('nav.streak_days', { count: streak })}
              className="flex h-11 min-w-11 items-center justify-center gap-1 px-2 text-fg active:opacity-60"
            >
              <IconFlame className="h-4 w-4 text-accent" />
              <span className="font-display text-base font-bold tabular leading-none">
                {streak}
              </span>
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
            <Refresh className="w-3.5 h-3.5 text-accent" />
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
      <div className="relative flex-1 min-h-0">
        <div className="glass-scroll-fade top-0" data-visible={edges.top} aria-hidden="true" />
        <main
          ref={scrollerRef}
          onScroll={updateEdges}
          className="h-full px-4 pt-4 pb-24 overflow-y-auto"
        >
          <m.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {children}
          </m.div>
        </main>
        <div
          className="glass-scroll-fade glass-scroll-fade-bottom bottom-0"
          data-visible={edges.bottom}
          aria-hidden="true"
        />
      </div>

      {/* Barra inferior de la referencia visual: fondo del lienzo, filete
          superior, icono + rótulo por pestaña y una barrita de acento sobre la
          activa. Se mantiene la altura y el safe-area de siempre. */}
      <nav
        className="glass-3 glass-flush glass-flush-t flex flex-shrink-0 relative z-10"
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
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 relative transition-opacity active:opacity-60"
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
              {/* Con cuatro pestañas cada una medía ~97 px; con cinco caen a
                  ~78 px en un móvil de 390 y a ~72 en uno de 360, que es
                  justamente el ancho al que «Estadísticas» se partía en dos
                  líneas.

                  El rótulo va en una línea, pero eso solo no basta: el WebView
                  de Android aplica el tamaño de letra del sistema, y con la
                  fuente al 130 % «PROGRESO» e «HISTORIAL» crecían fuera de su
                  celda y se leían pegados —«PROGRESOHISTORIAL»— porque nada les
                  impedía desbordar. Se arregla por los dos lados: la celda puede
                  encogerse (`min-w-0`) y el texto se recorta dentro de ella
                  (`truncate`) en vez de invadir la vecina, y la tipografía parte
                  de un cuerpo menor y sin apenas interletraje para que a escalas
                  normales y grandes entre entero sin llegar a recortarse.

                  Sin `label-caps` a propósito: esa clase fija `font-size` y
                  `letter-spacing` de suyo y gana a las utilidades, así que el
                  «apretar un punto la tipografía» de antes no llegaba a
                  aplicarse nunca —el rótulo seguía saliendo a 11 px con 0.1em—
                  y por eso no había margen que valiera. Aquí las mayúsculas y
                  la negrita se piden a mano. */}
              <span
                className={`block max-w-full truncate text-center font-bold uppercase leading-[1.1] text-[0.5625rem] tracking-[0.02em] transition-colors ${
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
