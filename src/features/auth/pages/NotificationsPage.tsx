import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { Layout } from '@app/components/Layout';
import { IconCheckBadge, IconTimer } from '@shared/components/icons';
import { useNotificationsStore } from '@shared/stores/notificationsStore';

/** "hace 5 min", "hace 2 h", "hace 3 d" — suficiente para un historial corto. */
function useRelativeTime() {
  const { t } = useTranslation();
  return (at: number) => {
    const mins = Math.floor((Date.now() - at) / 60000);
    if (mins < 1) return t('notifications.just_now');
    if (mins < 60) return t('notifications.minutes_ago', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('notifications.hours_ago', { count: hours });
    return t('notifications.days_ago', { count: Math.floor(hours / 24) });
  };
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const items = useNotificationsStore((s) => s.items);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const clear = useNotificationsStore((s) => s.clear);
  const relative = useRelativeTime();

  // Abrir la pantalla es haberlas visto: apaga el punto de la campana.
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  return (
    <Layout>
      <div className="space-y-3 pb-8">
        {items.length > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clear}
              className="min-h-11 rounded-pill bg-surface-2 px-4 text-sm text-fg-muted active:opacity-70"
            >
              {t('notifications.clear')}
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2">
              <IconTimer className="h-7 w-7 text-fg-subtle" />
            </span>
            <p className="text-base font-semibold text-fg">{t('notifications.empty_title')}</p>
            <p className="max-w-xs text-sm text-fg-subtle">{t('notifications.empty_desc')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n, i) => (
              <m.li
                key={n.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }}
                className="flex gap-3 rounded-card bg-surface p-3.5"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
                  <IconCheckBadge className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="truncate text-sm font-semibold text-fg">{n.title}</h2>
                    <span className="flex-shrink-0 text-2xs text-fg-subtle">{relative(n.at)}</span>
                  </div>
                  {n.body && <p className="mt-0.5 text-sm text-fg-muted">{n.body}</p>}
                </div>
              </m.li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
