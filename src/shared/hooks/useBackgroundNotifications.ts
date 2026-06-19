import { useEffect } from 'react';
import { useAuthStore } from '@features/auth/stores/authStore';
import { checkStreakAtRisk } from '@shared/lib/streakChecker';
import { checkWeeklySummary } from '@shared/lib/weeklySummary';
import {
  isNative,
  scheduleStreakReminder,
  cancelStreakReminder,
  scheduleWeeklySummaryReminder,
  canNotifyAsync,
} from '@shared/lib/notifications';
import { devError, devLog } from '@shared/lib/devtools';
import { supabase } from '@shared/lib/supabase';
import { toLocalDateKey } from '@shared/lib/dateKeys';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { registerPushNotifications } from '@shared/lib/push';

/**
 * Gestión de notificaciones background:
 *
 * 1. Alarmas nativas (funcionan con app cerrada):
 *    - Racha: diaria a las 20:00 — si no entrenó hoy, suena.
 *    - Resumen semanal: lunes 09:00 — texto genérico.
 *    - Rutina: ya se programa en useWorkoutReminder.
 *
 * 2. Checks en foreground (complemento al abrir la app):
 *    - Racha: si ya entrenó hoy → cancela la alarma del día.
 *    - Resumen: si es lunes → muestra notificación con datos reales.
 */
export function useBackgroundNotifications() {
  const userId = useAuthStore((s) => s.user?.id);

  // Al arrancar (o al cambiar de usuario): sincronizar el flag de notificaciones
  // con la DB y reprogramar las alarmas nativas si procede. Sin esto, tras
  // reiniciar la app el toggle/localStorage quedaba desfasado y no se reprogramaba.
  useEffect(() => {
    if (!userId) return;

    void (async () => {
      // 1. Sincronizar notifications_enabled (fuente multi-dispositivo: DB)
      try {
        const { data } = await supabase
          .from('profiles')
          .select('notifications_enabled')
          .eq('id', userId)
          .single();
        if (data) {
          useSettingsStore.getState().setNotificationsEnabled(!!data.notifications_enabled);
        }
      } catch (e) {
        devError('[Background] Error sincronizando notifications_enabled:', e);
      }

      // 2. Reprogramar alarmas nativas (persisten tras reinicio) si hay permiso
      //    y las notificaciones están activas (canNotifyAsync lee notif_disabled)
      if (!isNative()) return;
      if (!(await canNotifyAsync())) return;
      await scheduleStreakReminder();
      await scheduleWeeklySummaryReminder();
      // Registro push remoto (refresca el token del dispositivo en cada arranque)
      void registerPushNotifications(userId);
      devLog('[Background] Alarmas nativas programadas');
    })();
  }, [userId]);

  // Check en foreground al abrir: cancelar racha si ya entrenó hoy,
  // y disparar resumen semanal con datos reales si aplica
  useEffect(() => {
    if (!userId) return;

    const runForegroundChecks = async () => {
      try {
        // Si ya entrenó hoy, cancelar la alarma de racha del día
        if (isNative()) {
          const trainedToday = await hasTrainedToday(userId);
          if (trainedToday) {
            await cancelStreakReminder();
            devLog('[Background] Racha cancelada: ya entrenó hoy');
          } else {
            // Re-programar para que suene esta noche si no había
            await scheduleStreakReminder();
          }
        }

        // Resumen semanal con datos reales (solo la primera vez que abre el lunes)
        await checkWeeklySummary(userId);

        // Check de racha para web (que no tiene alarmas nativas)
        if (!isNative()) {
          const now = new Date();
          const dateStr = now.toISOString().split('T')[0];
          const streakKey = `streak_notif_${dateStr}`;

          if (now.getHours() >= 20 && !localStorage.getItem(streakKey)) {
            const atRisk = await checkStreakAtRisk(userId);
            if (atRisk) {
              const { notify } = await import('@shared/lib/notifications');
              await notify('🔥 Tu racha está en peligro', {
                body: 'Tantos días seguidos... No lo pierdas hoy.',
                icon: '/icon-192x192.webp',
                url: '/',
              });
              localStorage.setItem(streakKey, 'true');
            }
          }
        }
      } catch (e) {
        devError('Background notification check failed:', e);
      }
    };

    void runForegroundChecks();
  }, [userId]);
}

/** Comprueba si el usuario ha registrado un workout hoy. */
async function hasTrainedToday(userId: string): Promise<boolean> {
  const today = toLocalDateKey(new Date());
  const startOfDay = `${today}T00:00:00`;
  const { data } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .gte('started_at', startOfDay)
    .limit(1);
  return !!data && data.length > 0;
}
