import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { checkStreakAtRisk } from '@shared/lib/streakChecker';
import { toLocalDateKey } from '@shared/lib/dateKeys';
import { checkWeeklySummary } from '@shared/lib/weeklySummary';
import {
  isNative,
  scheduleWeeklySummaryReminder,
  canNotifyAsync,
  type ReminderDay,
} from '@shared/lib/notifications';
import { reconcileReminders } from '@shared/lib/reminderReconcile';
import { devError, devLog } from '@shared/lib/devtools';
import { supabase } from '@shared/lib/supabase';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { registerPushNotifications } from '@shared/lib/push';

/**
 * Gestión de notificaciones background:
 *
 * 1. Alarmas nativas (funcionan con app cerrada), a las horas que elija el
 *    usuario en Ajustes → Recordatorios:
 *    - Racha: diaria — no se programa si ya entrenó hoy.
 *    - Rutina: semanal por día de rutina — el día de hoy se omite si ya entrenó.
 *    - Resumen semanal: día y hora configurables, texto genérico.
 *
 * 2. Reconciliación (reconcileReminders): decide "¿toca avisar hoy?" según si el
 *    usuario ya ha entrenado. Se dispara al abrir la app, al reanudarla
 *    (appStateChange) y tras guardar un entreno (workoutStore).
 */
export function useBackgroundNotifications(
  userId: string | null,
  getRoutineDays: () => ReminderDay[],
) {
  // La identidad del usuario y los días de la rutina activa los pasa el
  // llamador (AppRoutes): el hook vive en @shared y no debe depender de
  // stores de features.

  // Contador que cambia al cruzar la medianoche. Va en el estado y no en una
  // variable porque lo que tiene que provocar es un re-render: cruzar la
  // medianoche con la app abierta no emite ningún evento de Capacitor, así que
  // «¿he entrenado hoy?», el plan de la semana y el día que le toca a la rutina
  // se quedaban con el estado de ayer hasta la próxima apertura —que puede no
  // llegar antes de que suene la alarma.
  const [dayTick, setDayTick] = useState(0);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(
      () => setDayTick((n) => n + 1),
      nextMidnight.getTime() - now.getTime(),
    );
    return () => clearTimeout(timer);
  }, [dayTick]);

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
      await reconcileReminders(userId, getRoutineDays());
      await scheduleWeeklySummaryReminder();
      // Registro push remoto (refresca el token del dispositivo en cada arranque)
      void registerPushNotifications(userId);
      devLog('[Background] Alarmas nativas programadas');
    })();
  }, [userId, getRoutineDays, dayTick]);

  // Check en foreground al abrir: reconciliar recordatorios (rutina + racha) con
  // el estado real de entrenamiento y disparar el resumen semanal si aplica.
  useEffect(() => {
    if (!userId) return;

    const runForegroundChecks = async () => {
      try {
        // Reconcilia rutina + racha del día según si ya entrenó hoy.
        await reconcileReminders(userId, getRoutineDays());

        // Resumen semanal con datos reales (solo la primera vez que abre el lunes)
        await checkWeeklySummary(userId);

        // Check de racha para web (que no tiene alarmas nativas)
        if (!isNative()) {
          const now = new Date();
          // Clave del día local: con la fecha UTC el «una vez al día» cambiaba a
          // las 2:00 y el aviso podía salir dos veces en la misma madrugada.
          const dateStr = toLocalDateKey(now);
          const streakKey = `streak_notif_${dateStr}`;

          // La hora la elige el usuario; antes estaba a fuego a las 20:00 y en
          // web el aviso llegaba a una hora distinta de la que decían Ajustes.
          const streakTime = useSettingsStore.getState().reminderTimes.streak;
          const afterStreakHour =
            now.getHours() > streakTime.hour ||
            (now.getHours() === streakTime.hour && now.getMinutes() >= streakTime.minute);

          if (afterStreakHour && !localStorage.getItem(streakKey)) {
            const atRisk = await checkStreakAtRisk(userId);
            if (atRisk) {
              const { notify, getStreakReminderCopy } = await import('@shared/lib/notifications');
              const copy = getStreakReminderCopy();
              await notify(copy.title, {
                body: copy.body,
                icon: '/icon-192x192.webp',
                url: '/',
                type: 'streak',
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

    // Reconciliar también cada vez que la app vuelve a primer plano: si el
    // usuario entrenó con la app en background, al volver se cancela el aviso.
    if (!isNative()) return;
    const handle = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void reconcileReminders(userId, getRoutineDays());
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [userId, getRoutineDays, dayTick]);
}
