import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import { useCapacitorListener } from '@shared/hooks/useCapacitorListener';
import { devError } from '@shared/lib/devtools';

/**
 * Aplica el calendario de rutinas: cuando llega la fecha que se programó para
 * un bloque, ese bloque pasa a ser la rutina activa sin que haya que tocar
 * nada.
 *
 * Corre en el cliente, y por eso el momento exacto es «la primera vez que se
 * abre la app a partir de esa fecha», no la medianoche del día 1. Es una
 * decisión, no una limitación que se arrastre: mover esto a un cron del
 * servidor obligaría a que la fuente de verdad del calendario fuese la nube,
 * y hoy las rutinas se editan y se usan también sin conexión. Quien entrena
 * abre la app antes de entrenar, así que el cambio siempre llega a tiempo
 * para la sesión que le importa. `dueScheduleEntry` cubre el retraso: entra
 * el bloque vencido más reciente, no el que coincida con el día exacto.
 *
 * Se comprueba al arrancar y al volver del segundo plano. Lo segundo no es
 * adorno: un teléfono que no se cierra nunca puede cruzar la medianoche del
 * día 1 con la app abierta, y sin esa segunda comprobación el cambio se
 * quedaría esperando a un reinicio que quizá no llega en semanas.
 */
export function useScheduledRoutine(): void {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  // Evita solapar dos comprobaciones (arranque + volver del segundo plano casi
  // a la vez): la segunda leería el store a mitad de la hidratación.
  const runningRef = useRef(false);

  const check = useCallback(async () => {
    if (!userId || runningRef.current) return;
    runningRef.current = true;

    try {
      const store = useRoutineStore.getState();
      // Sin leer la nube, un calendario creado en el móvil no llegaría nunca al
      // portátil. Solo la primera comprobación de la sesión hidrata; las de
      // volver del segundo plano trabajan sobre lo que ya hay en memoria.
      if (!store.hydrated) await store.loadFromDb(userId);

      const activated = useRoutineStore.getState().applyDueSchedule();
      if (!activated) return;

      toast.success(t('routine.schedule_applied', { name: activated.name }));
      // El cambio es una decisión más de este dispositivo: se sube para que el
      // resto no vuelva a aplicarlo por su cuenta.
      await useRoutineStore.getState().saveToDb(userId);
    } catch (err) {
      // Que falle la red no puede tumbar el arranque: el calendario local
      // sigue ahí y se reintenta en la siguiente comprobación.
      devError('[useScheduledRoutine]', err);
    } finally {
      runningRef.current = false;
    }
  }, [userId, t]);

  useEffect(() => {
    if (!userId) return;
    void check();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, check]);

  // En nativo el WebView puede reanudarse sin emitir `visibilitychange`.
  useCapacitorListener(
    'appStateChange',
    ({ isActive }) => {
      if (isActive) void check();
    },
    Capacitor.isNativePlatform(),
  );
}
