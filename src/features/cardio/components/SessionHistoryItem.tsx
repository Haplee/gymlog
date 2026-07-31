import { useTranslation } from 'react-i18next';
import { CARDIO_LABELS, type CardioSession } from '@features/cardio/stores/cardioStore';
import { SwipeToDelete } from '@shared/components/SwipeToDelete';
import { CardioTypeIcon } from '@shared/components/CardioIcons';
import { formatDuration } from '@shared/lib/duration';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { HeartPulse } from 'lucide-react';

/** HOY / AYER / abreviatura del día, en mayúsculas. */
function dayLabel(date: Date, t: (key: string) => string) {
  if (isToday(date)) return t('common.today');
  if (isYesterday(date)) return t('common.yesterday');
  return format(date, 'EEE', { locale: es });
}

export function SessionHistoryItem({
  session,
  onDelete,
}: {
  session: CardioSession;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const startedAt = parseISO(session.startedAt);

  return (
    // Se borra deslizando, como en el historial de entrenamientos: la maqueta
    // no lleva papelera por fila y el gesto ya es el patrón de la app.
    <SwipeToDelete onDelete={onDelete}>
      {/* Fila en línea: icono de la actividad a la izquierda, texto en el
          centro y el dato duro a la derecha. Es el mismo esqueleto que el resto
          de listas de la app; sin el icono esta era la única cuyas filas
          empezaban con el texto pegado al borde. */}
      <div className="dotted-separator flex items-center gap-3 py-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-muted">
          <CardioTypeIcon type={session.type} className="w-4 h-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base font-semibold text-fg truncate">
              {CARDIO_LABELS[session.type]}
            </span>
            <span className="font-display font-bold tabular text-fg flex-shrink-0">
              {formatDuration(session.duration)}
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="label-caps text-fg-subtle flex items-center gap-2 min-w-0">
              <span className="truncate">
                {dayLabel(startedAt, t)} · {format(startedAt, 'HH:mm')}
              </span>
              {session.avgHr && (
                <span className="flex items-center gap-0.5">
                  <HeartPulse className="w-3 h-3" /> {session.avgHr}
                  {session.maxHr ? `/${session.maxHr}` : ''}
                </span>
              )}
              {session.source && session.source !== 'manual' && (
                <span className="px-1.5 py-0.5 rounded-sm bg-surface-2">
                  {t('cardio.health_source')}
                </span>
              )}
            </div>

            <span className="text-sm tabular text-fg-muted flex-shrink-0">
              {session.distance
                ? `${session.distance.toLocaleString(undefined, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })} km`
                : session.calories
                  ? `${session.calories} kcal`
                  : ''}
            </span>
          </div>

          {session.notes && (
            <div className="text-xs italic mt-1 text-fg-subtle">{session.notes}</div>
          )}
        </div>
      </div>
    </SwipeToDelete>
  );
}
