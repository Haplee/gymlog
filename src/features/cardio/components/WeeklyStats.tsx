import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { formatDuration } from '@shared/lib/duration';
import type { CardioSession } from '@features/cardio/stores/cardioStore';

export function WeeklyStats({ sessions }: { sessions: CardioSession[] }) {
  const { t } = useTranslation();
  const now = new Date();
  const weekStart = new Date(now);
  const daysSinceMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
  weekStart.setDate(now.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekSessions = sessions.filter((s) => new Date(s.startedAt) >= weekStart);
  const totalTime = weekSessions.reduce((sum, s) => sum + s.duration, 0);
  const totalDist = weekSessions.reduce((sum, s) => sum + (s.distance ?? 0), 0);
  const totalCals = weekSessions.reduce((sum, s) => sum + (s.calories ?? 0), 0);

  if (weekSessions.length === 0) return null;

  return (
    <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
      {/* `gap-0` juntaba las tres columnas hasta tocarse: a 390 px cada una son
          ~120 px y las etiquetas en mayúsculas con tracking ancho se comían el
          hueco de la vecina. Con separación y `min-w-0` cada celda se queda en
          lo suyo, y las cifras no parten a mitad de número. */}
      <div className="grid grid-cols-3 gap-3 hairline-separator pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="label-caps truncate text-fg-subtle">{t('cardio.sessions')}</span>
          <span className="text-data font-display font-bold text-fg tabular whitespace-nowrap">
            {weekSessions.length}
          </span>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-1">
          <span className="label-caps truncate text-fg-subtle">{t('cardio.time')}</span>
          <span className="text-data font-display font-bold text-fg tabular whitespace-nowrap">
            {formatDuration(totalTime)}
          </span>
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1">
          {totalDist > 0 ? (
            <>
              <span className="label-caps truncate text-fg-subtle">{t('cardio.distance')}</span>
              <span className="text-data font-display font-bold text-fg tabular whitespace-nowrap">
                {totalDist.toLocaleString(undefined, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                km
              </span>
            </>
          ) : totalCals > 0 ? (
            <>
              <span className="label-caps truncate text-fg-subtle">kcal</span>
              <span className="text-data font-display font-bold text-fg tabular whitespace-nowrap">
                {totalCals}
              </span>
            </>
          ) : (
            <>
              <span className="label-caps truncate text-fg-subtle">km</span>
              <span className="text-data font-display font-bold text-fg tabular whitespace-nowrap">
                —
              </span>
            </>
          )}
        </div>
      </div>
    </m.div>
  );
}
