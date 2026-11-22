import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import {
  Bell,
  IconBook,
  IconDumbbell,
  IconGear,
  IconHistory,
  IconSearch,
  IconStar,
  IconTrophy,
  IconWatch,
  X,
} from '@shared/components/icons';
import { COACH_UI_ENABLED } from '@features/coach/lib/featureFlag';
import { GymLogLogo } from '@shared/components/ui';
import { useProfile } from '@features/auth/hooks/useProfile';

/**
 * Cajón de navegación que abre la hamburguesa de la cabecera.
 *
 * La cabecera de la referencia visual (`public/screens/*.png`) es hamburguesa +
 * wordmark + usuario, así que la lupa, la campana y la búsqueda se quedaron sin
 * sitio. En vez de eliminarlas —serían funcionalidad perdida— viven aquí.
 *
 * El cajón es el mapa completo de la app: están todos los destinos, con su
 * rótulo y su icono, también los que la barra inferior ya tiene (Progreso,
 * Historial). La barra inferior sirve para lo que se usa entrenando; el cajón,
 * para encontrar.
 */
interface AppDrawerProps {
  onClose: () => void;
  /** Abre la hoja de búsqueda, que vive en Layout porque también se usa sin el cajón. */
  onOpenSearch: () => void;
  unreadCount: number;
}

export function AppDrawer({ onClose, onOpenSearch, unreadCount }: AppDrawerProps) {
  const { t } = useTranslation();
  const { avatarUrl, displayName } = useProfile();
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

  // Agrupado por intención: primero lo que se consulta durante el entreno,
  // después lo que se abre de vez en cuando.
  const groups: {
    title: string;
    links: { to: string; Icon: typeof IconBook; label: string; badge?: boolean }[];
  }[] = [
    {
      title: t('nav.group_training'),
      links: [
        { to: '/user-stats', label: t('nav.progress'), Icon: IconTrophy },
        { to: '/exercises', Icon: IconDumbbell, label: t('library.title') },
        { to: '/history', label: t('nav.history'), Icon: IconHistory },
      ],
    },
    {
      title: t('nav.group_more'),
      links: [
        // El entrenador se filtra, no se comenta: con el interruptor apagado
        // (`VITE_AI_COACH_UI_ENABLED`) la fila no debe existir, ni siquiera como
        // enlace muerto.
        ...(COACH_UI_ENABLED
          ? [{ to: '/coach', Icon: IconStar, label: t('coach.page_title') }]
          : []),
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
        className="glass-3 glass-solid glass-flush glass-flush-r fixed left-0 top-0 z-[201] flex h-full w-[80%] max-w-xs flex-col overflow-y-auto outline-none"
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
          <GymLogLogo
            variant="horizontal"
            size="sm"
            animated
            interactive
            aria-label={t('app.title', { defaultValue: 'GymLog' })}
            className="select-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('nav.menu_close')}
            className="flex h-11 w-11 items-center justify-center text-fg-subtle active:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Perfil de usuario en la cabecera del cajón */}
        <div className="px-4 py-3 flex items-center gap-3 border-b border-line">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width={40}
              height={40}
              decoding="async"
              className="w-10 h-10 rounded-full object-cover border border-line-strong"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-fg font-display font-bold text-base uppercase">
              {displayName?.slice(0, 1) || '?'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg truncate">{displayName}</p>
            <p className="text-xs text-fg-subtle truncate">{t('nav.profile_subtitle')}</p>
          </div>
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
