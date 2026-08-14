import { useTranslation } from 'react-i18next';
import { m, AnimatePresence } from 'framer-motion';
import { useRestTimerStore } from '@features/workout/stores/restTimerStore';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { BellRing } from '@shared/components/icons';

/**
 * Banner global de alarma: mientras suena, es alcanzable desde cualquier
 * pantalla y ofrece la única acción que la detiene.
 */
export function RestAlarmBanner() {
  const { t } = useTranslation();
  const alarmRinging = useRestTimerStore((s) => s.alarmRinging);
  const dismissAlarm = useRestTimerStore((s) => s.dismissAlarm);

  return (
    <AnimatePresence>
      {alarmRinging && (
        <m.div
          key="rest-alarm"
          role="alert"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex items-center justify-between gap-3 py-2 px-4 flex-shrink-0 bg-accent border-b border-line-accent"
        >
          <div className="flex items-center gap-2 min-w-0">
            <BellRing className="w-4 h-4 flex-shrink-0 text-accent-fg" aria-hidden="true" />
            <span className="text-sm font-semibold truncate text-accent-fg">
              {t('workout.rest_over')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              dismissAlarm();
              void impact(ImpactStyle.Medium);
            }}
            className="flex-shrink-0 min-h-11 px-4 rounded-sm text-xs font-display font-bold uppercase tracking-[0.1em] bg-accent-fg text-accent active:scale-[0.97] transition-transform"
          >
            {t('workout.stop_alarm')}
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
