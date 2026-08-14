import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { useCardioStore } from '@features/cardio/stores/cardioStore';
import {
  Bell,
  IconBook,
  IconChart,
  IconDumbbell,
  IconGear,
  IconPulse,
  IconRuler,
  IconSearch,
  IconStar,
  IconWatch,
  X,
} from '@shared/components/icons';

/**
 * Cajón de navegación que abre la hamburguesa de la cabecera.
 *
 * La cabecera de la referencia visual (`public/screens/*.png`) es hamburguesa +
 * wordmark + usuario, así que la lupa, la campana y la pestaña de historial se
 * quedaron sin sitio. En vez de eliminarlas —serían funcionalidad perdida— viven
 * aquí, junto a las rutas que nunca tuvieron entrada propia en la barra inferior
 * (biblioteca, medidas, wearables, guía, entrenador).
 *
 * Desde la decisión de dejar la barra inferior en cuatro pestañas (inicio,
 * rutinas, historial y cardio), Estadísticas y Ajustes también viven aquí.
 *
 * **Nada de lo que hay aquí está en la barra inferior ni en la cabecera.** Un
 * cajón que repite los destinos que ya tienes a un dedo de distancia solo añade
 * ruido.
 */
interface AppDrawerProps {
  onClose: () => void;
  /** Abre la hoja de búsqueda, que vive en Layout porque también se usa sin el cajón. */
  onOpenSearch: () => void;
  unreadCount: number;
}

export function AppDrawer({ onClose, onOpenSearch, unreadCount }: AppDrawerProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  // Sesión de cardio en marcha: el cajón mantiene el punto que antes llevaba su
  // pestaña en la barra inferior.
  const cardioActive = useCardioStore((s) => s.isActive);

  // Escape cierra, y el foco entra en el panel para que el lector de pantalla no
  // siga leyendo la página de debajo.
  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Agrupado por intención: primero lo que se consulta durante el entreno,
  // después lo que se abre de vez en cuando.
  const groups: {
    title: string;
    links: { to: string; Icon: typeof IconBook; label: string; badge?: boolean }[];
  }[] = [
    {
      title: t('nav.group_training'),
      links: [
        { to: '/stats', Icon: IconChart, label: t('nav.stats') },
        { to: '/cardio', Icon: IconPulse, label: t('nav.cardio'), badge: cardioActive },
        { to: '/exercises', Icon: IconDumbbell, label: t('library.title') },
        { to: '/user-stats', Icon: IconRuler, label: t('settings.my_measurements') },
      ],
    },
    {
      title: t('nav.group_more'),
      links: [
        { to: '/coach', Icon: IconStar, label: t('coach.page_title') },
        { to: '/wearables', Icon: IconWatch, label: t('settings.wearables') },
        { to: '/guide', Icon: IconBook, label: t('guide.title') },
      ],
    },
  ];

  const rowClass =
    'flex min-h-12 items-center gap-3 rounded-card px-3 text-left text-sm text-fg transition-colors active:bg-hover';

  return (
    <>
      {/* Velo neutro, no `bg-canvas/70`: teñir con el color del lienzo aclaraba
          toda la pantalla en tema claro y parecía que la app cambiaba de color
          al abrir el menú. Un negro translúcido oscurece igual en ambos temas. */}
      <m.div
        key="drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
        className="fixed inset-0 z-[200] bg-black/50"
        aria-hidden="true"
      />
      <m.div
        key="drawer-panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.menu')}
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        // Se cierra arrastrando hacia la izquierda, que es el gesto que espera
        // cualquiera que haya abierto un cajón antes.
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -60 || info.velocity.x < -400) onClose();
        }}
        className="glass-3 glass-flush glass-flush-r fixed left-0 top-0 z-[201] flex h-full w-[80%] max-w-xs flex-col overflow-y-auto outline-none"
        style={{
          paddingTop: 'var(--inset-top, env(safe-area-inset-top))',
          paddingBottom: 'var(--inset-bottom, env(safe-area-inset-bottom))',
          paddingLeft: 'var(--inset-left, env(safe-area-inset-left))',
        }}
      >
        <div
          className="flex items-center justify-between pl-4 pr-2"
          style={{ minHeight: 'var(--header-height)' }}
        >
          <span className="font-display text-lg font-bold tracking-tight text-fg">
            GYM<span className="text-accent">LOG</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('nav.menu_close')}
            className="flex h-11 w-11 items-center justify-center text-fg-subtle active:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 px-2 pb-4">
          <button type="button" onClick={onOpenSearch} className={rowClass}>
            <IconSearch className="h-5 w-5 shrink-0 text-fg-subtle" />
            {t('search.placeholder')}
          </button>

          <Link to="/notifications" onClick={onClose} className={rowClass}>
            <Bell className="h-5 w-5 shrink-0 text-fg-subtle" />
            <span className="flex-1">{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <span className="label-caps rounded-pill bg-accent px-2 py-0.5 text-accent-fg">
                {unreadCount}
              </span>
            )}
          </Link>

          {groups.map(({ title, links }) => (
            <div key={title} className="mt-4">
              <div className="label-caps px-3 pb-1 text-fg-subtle">{title}</div>
              {links.map(({ to, Icon, label, badge }) => (
                <Link key={to} to={to} onClick={onClose} className={rowClass}>
                  <span className="relative">
                    <Icon className="h-5 w-5 shrink-0 text-fg-subtle" />
                    {badge && (
                      <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-error" />
                    )}
                  </span>
                  {label}
                </Link>
              ))}
            </div>
          ))}

          <div className="mt-4 border-t border-line pt-2">
            <Link to="/settings" onClick={onClose} className={rowClass}>
              <IconGear className="h-5 w-5 shrink-0 text-fg-subtle" />
              {t('nav.settings')}
            </Link>
          </div>
        </nav>
      </m.div>
    </>
  );
}
