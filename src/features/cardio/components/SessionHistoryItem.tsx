import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { m, AnimatePresence } from 'framer-motion';
import { CARDIO_LABELS, type CardioSession } from '@features/cardio/stores/cardioStore';
import { CardioTypeIcon } from '@shared/components/CardioIcons';
import { formatDuration } from '@shared/lib/duration';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, HeartPulse } from 'lucide-react';

export function SessionHistoryItem({
  session,
  onDelete,
}: {
  session: CardioSession;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex items-center justify-between py-3 dotted-separator">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-accent flex-shrink-0">
          <CardioTypeIcon type={session.type} className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-fg">
            {CARDIO_LABELS[session.type]}
            <span className="ml-2 font-display font-bold tabular text-accent">
              {formatDuration(session.duration)}
            </span>
          </div>
          <div className="text-xs flex items-center gap-2 flex-wrap text-fg-subtle">
            <span>
              {formatDistanceToNow(parseISO(session.startedAt), { addSuffix: true, locale: es })}
            </span>
            {session.distance && <span>· {session.distance}km</span>}
            {session.calories && <span>· {session.calories}kcal</span>}
            {session.avgHr && (
              <span className="flex items-center gap-0.5">
                · <HeartPulse className="w-3 h-3" /> {session.avgHr}
                {session.maxHr ? `/${session.maxHr}` : ''}
              </span>
            )}
            {session.source && session.source !== 'manual' && (
              <span className="label-caps px-1.5 py-0.5 rounded-sm bg-surface-2">
                {t('cardio.health_source')}
              </span>
            )}
          </div>
          {session.notes && (
            <div className="text-xs italic mt-0.5 text-fg-subtle">{session.notes}</div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {confirmDelete ? (
          <m.div
            key="confirm"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex gap-1"
          >
            <button
              type="button"
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
              aria-label={t('common.confirm')}
              className="w-8 h-8 rounded-sm flex items-center justify-center text-xs font-bold bg-error text-accent-fg"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              aria-label={t('common.cancel')}
              className="w-8 h-8 rounded-sm flex items-center justify-center border border-line text-fg-muted"
            >
              ✕
            </button>
          </m.div>
        ) : (
          <m.button
            key="trash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmDelete(true)}
            aria-label={t('common.delete')}
            className="p-2 rounded-sm text-fg-subtle"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </m.button>
        )}
      </AnimatePresence>
    </div>
  );
}
