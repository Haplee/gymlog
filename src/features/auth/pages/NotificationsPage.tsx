import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { m } from 'framer-motion';
import { Layout } from '@app/components/Layout';
import {
  IconCalendar,
  IconChart,
  IconCheckBadge,
  IconFlame,
  IconTimer,
  IconTrophy,
  type IconComponent,
} from '@shared/components/icons';
import { PageHeader } from '@shared/components/ui';
import {
  useNotificationsStore,
  type NotificationItem,
  type NotificationType,
} from '@shared/stores/notificationsStore';
import { toLocalDateKey } from '@shared/lib/dateKeys';

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

/** Un icono por categoría: de un vistazo se distingue un récord de un aviso de
    rutina sin leer el texto. Antes todos llevaban el mismo. */
const TYPE_ICON: Record<NotificationType, IconComponent> = {
  routine: IconCalendar,
  streak: IconFlame,
  summary: IconChart,
  pr: IconTrophy,
  timer: IconTimer,
  generic: IconCheckBadge,
};

/** Filtros disponibles. 'timer' y 'generic' no tienen chip propio: caen en
    «Todo» porque no son categorías que nadie busque a propósito. */
const FILTERS = ['all', 'routine', 'streak', 'summary', 'pr'] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABEL: Record<Filter, string> = {
  all: 'notifications.filter_all',
  routine: 'notifications.filter_routine',
  streak: 'notifications.filter_streak',
  summary: 'notifications.filter_summary',
  pr: 'notifications.filter_pr',
};

/** Agrupa por día local conservando el orden (los items ya vienen recientes primero). */
function groupByDay(items: NotificationItem[]): [string, NotificationItem[]][] {
  const groups = new Map<string, NotificationItem[]>();
  for (const item of items) {
    const key = toLocalDateKey(new Date(item.at));
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()];
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const items = useNotificationsStore((s) => s.items);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const remove = useNotificationsStore((s) => s.remove);
  const clear = useNotificationsStore((s) => s.clear);
  const relative = useRelativeTime();
  const [filter, setFilter] = useState<Filter>('all');

  // Abrir la pantalla es haberlas visto: apaga el punto de la campana.
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((n) => n.type === filter)),
    [items, filter],
  );
  const groups = useMemo(() => groupByDay(visible), [visible]);

  const dayLabel = (key: string): string => {
    const today = toLocalDateKey(new Date());
    if (key === today) return t('notifications.today');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (key === toLocalDateKey(yesterday)) return t('notifications.yesterday');
    return new Date(key).toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  return (
    <Layout>
      <div className="space-y-3 pb-8">
        <PageHeader
          title={t('notifications.title')}
          action={
            items.length > 0 ? (
              <button
                type="button"
                onClick={clear}
                className="min-h-11 rounded-pill bg-surface-2 px-4 text-sm text-fg-muted active:opacity-70"
              >
                {t('notifications.clear')}
              </button>
            ) : undefined
          }
          className="mb-0"
        />

        {items.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {FILTERS.map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={active}
                  className={`min-h-11 flex-shrink-0 rounded-pill px-4 text-sm transition-colors ${
                    active
                      ? 'bg-accent font-semibold text-accent-fg'
                      : 'bg-surface-2 text-fg-muted active:opacity-70'
                  }`}
                >
                  {t(FILTER_LABEL[f])}
                </button>
              );
            })}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2">
              <IconTimer className="h-7 w-7 text-fg-subtle" />
            </span>
            <p className="text-base font-semibold text-fg">
              {items.length === 0
                ? t('notifications.empty_title')
                : t('notifications.empty_filter')}
            </p>
            {items.length === 0 && (
              <p className="max-w-xs text-sm text-fg-subtle">{t('notifications.empty_desc')}</p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(([day, dayItems]) => (
              <section key={day} className="space-y-2">
                <h2 className="px-1 text-2xs font-semibold uppercase tracking-wide text-fg-subtle">
                  {dayLabel(day)}
                </h2>
                <ul className="space-y-2">
                  {dayItems.map((n, i) => {
                    const Icon = TYPE_ICON[n.type] ?? IconCheckBadge;
                    // Solo navega si el aviso trae destino; si no, la fila no es
                    // un botón y no promete algo que no hace.
                    const navigable = !!n.url;
                    return (
                      <m.li
                        key={n.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.2) }}
                        className="flex items-start gap-3 rounded-card bg-surface p-3.5"
                      >
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
                          <Icon className="h-5 w-5" />
                        </span>

                        {navigable ? (
                          <button
                            type="button"
                            onClick={() => navigate(n.url as string)}
                            className="min-w-0 flex-1 text-left active:opacity-70"
                          >
                            <ItemBody item={n} relative={relative} />
                          </button>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <ItemBody item={n} relative={relative} />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => remove(n.id)}
                          aria-label={t('notifications.delete_one')}
                          className="-mr-1.5 -mt-1.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-fg-subtle active:opacity-70"
                        >
                          <span aria-hidden="true" className="text-lg leading-none">
                            ×
                          </span>
                        </button>
                      </m.li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function ItemBody({
  item,
  relative,
}: {
  item: NotificationItem;
  relative: (at: number) => string;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-fg">{item.title}</h3>
        <span className="flex-shrink-0 text-2xs text-fg-subtle">{relative(item.at)}</span>
      </div>
      {item.body && <p className="mt-0.5 text-sm text-fg-muted">{item.body}</p>}
    </>
  );
}
