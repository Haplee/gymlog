import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { Bell } from 'lucide-react';
import {
  IconSearch,
  IconHistory,
  IconBook,
  IconRuler,
  IconWatch,
  IconGear,
  IconStar,
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
 * Es decir: la hamburguesa del mockup no es decorativa. Es el desagüe de todo lo
 * que el rediseño desplaza.
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

  const links = [
    { to: '/history', Icon: IconHistory, label: t('history.title') },
    { to: '/exercises', Icon: IconBook, label: t('library.title') },
    { to: '/user-stats', Icon: IconRuler, label: t('userStats.page_title') },
    { to: '/coach', Icon: IconStar, label: t('coach.page_title') },
    { to: '/wearables', Icon: IconWatch, label: t('settings.wearables') },
    { to: '/guide', Icon: IconBook, label: t('guide.title') },
    { to: '/settings', Icon: IconGear, label: t('settings.title') },
  ];

  const rowClass =
    'flex min-h-11 items-center gap-3 rounded-card px-3 py-2.5 text-left text-sm text-fg transition-colors active:bg-hover';

  return (
    <>
      <m.div
        key="drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
        className="fixed inset-0 z-[200] bg-canvas/70"
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
        className="fixed left-0 top-0 z-[201] flex h-full w-[80%] max-w-xs flex-col overflow-y-auto border-r border-line bg-surface outline-none"
        style={{
          paddingTop: 'var(--inset-top, env(safe-area-inset-top))',
          paddingBottom: 'var(--inset-bottom, env(safe-area-inset-bottom))',
          paddingLeft: 'var(--inset-left, env(safe-area-inset-left))',
        }}
      >
        <div className="flex items-center px-4" style={{ minHeight: 'var(--header-height)' }}>
          <span className="font-display text-lg font-bold tracking-tight text-fg">
            GYM<span className="text-accent">LOG</span>
          </span>
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

          {links.map(({ to, Icon, label }) => (
            <Link key={to} to={to} onClick={onClose} className={rowClass}>
              <Icon className="h-5 w-5 shrink-0 text-fg-subtle" />
              {label}
            </Link>
          ))}
        </nav>
      </m.div>
    </>
  );
}
