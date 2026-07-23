import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRestTimerStore } from '@features/workout/stores/restTimerStore';
import { useNotificationsStore } from '@shared/stores/notificationsStore';
import { useVisibilityPausedInterval } from '@shared/hooks/useVisibilityPausedInterval';
import { resumeIfRinging } from '@shared/lib/alarm';
import { impact, ImpactStyle } from '@shared/lib/haptics';

/**
 * Vigila el fin del descanso a nivel de app (montado una sola vez en Layout).
 *
 * Antes esto vivía dentro de RestTimer, que solo se monta en WorkoutPage: si el
 * usuario se iba a otra pestaña, el descanso nunca "terminaba" y no sonaba nada.
 * Aquí la alarma dispara estés donde estés, y el banner global permite pararla.
 */
/**
 * Si el descanso venció hace más de esto mientras la app estaba en segundo
 * plano, al volver no se hace sonar nada: la notificación del sistema ya avisó
 * en su momento y una alarma a destiempo solo sería ruido.
 */
const STALE_EXPIRY_MS = 2 * 60 * 1000;

export function useRestAlarm(): void {
  const { t } = useTranslation();
  const isRunning = useRestTimerStore((s) => s.isRunning);
  const endTime = useRestTimerStore((s) => s.endTime);
  const remaining = useRestTimerStore((s) => s.remaining);
  const complete = useRestTimerStore((s) => s.complete);
  const stop = useRestTimerStore((s) => s.stop);

  const check = useCallback(() => {
    if (remaining() > 0) return;

    const { endTime: end } = useRestTimerStore.getState();
    if (end !== null && Date.now() - end > STALE_EXPIRY_MS) {
      stop();
      return;
    }

    complete();
    void impact(ImpactStyle.Heavy);
    // El fin de descanso no pasa por notify(): la notificación del sistema se
    // programa por adelantado y el aviso in-app es este banner. Se apunta aquí,
    // que es el momento en que el usuario realmente recibe el aviso.
    useNotificationsStore.getState().add(t('workout.rest_over'), '');
  }, [remaining, complete, stop, t]);

  useVisibilityPausedInterval(check, 1000, isRunning && endTime !== null);

  // Al volver del background el WebView deja el AudioContext suspendido: sin
  // esto la alarma seguiría "sonando" en silencio.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) resumeIfRinging();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
}
