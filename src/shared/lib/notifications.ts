import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type Weekday } from '@capacitor/local-notifications';
import { toast } from 'sonner';
import { devError, devLog } from '@shared/lib/devtools';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/** IDs reservados: cada tipo tiene un id fijo → se puede cancelar/reemplazar sin duplicados. */
export const NOTIF_IDS = {
  TIMER: 990001,
  GENERIC: 990010,
  STREAK_DAILY: 990020,
  WEEKLY_SUMMARY: 990030,
  /** +1..7 (convención Capacitor: 1=domingo … 7=sábado) */
  ROUTINE_REMINDER_BASE: 991000,
} as const;

/** Canales Android 8+. Sin canal explícito el sistema usa defaults pobres
    (sin heads-up, importancia baja). iOS los ignora — el try los hace inocuos. */
const CHANNELS = [
  {
    id: 'reminders',
    name: 'Recordatorios',
    description: 'Rutina del día, rachas y resumen semanal',
    importance: 4 as const,
  },
  {
    id: 'timer',
    name: 'Temporizador de descanso',
    description: 'Aviso al terminar el descanso entre series',
    importance: 5 as const,
    vibration: true,
  },
];

/** Hora local del recordatorio de rutina */
const REMINDER_HOUR = 18;
const REMINDER_MINUTE = 30;

/** Hora de la alerta de racha en peligro */
const STREAK_HOUR = 20;
const STREAK_MINUTE = 0;

/** Hora del resumen semanal (lunes) */
const SUMMARY_HOUR = 9;
const SUMMARY_MINUTE = 0;

/**
 * Solo permite navegar a URLs http(s) del propio origen.
 * El extra de una notificación es dato no confiable: sin esta validación
 * un deep link manipulado podría abrir cualquier URL externa.
 */
export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return (
      (u.protocol === 'http:' || u.protocol === 'https:') && u.origin === window.location.origin
    );
  } catch {
    return false;
  }
}

export const isNotificationsDisabled = (): boolean =>
  localStorage.getItem('notif_disabled') === 'true';

/**
 * Inicialización única (providers): crea canales Android y registra el
 * listener de taps sobre notificaciones.
 */
export async function initNotifications(): Promise<void> {
  if (!isNative()) return;

  try {
    for (const channel of CHANNELS) {
      await LocalNotifications.createChannel(channel);
    }
  } catch (e) {
    // iOS no implementa canales — esperado
    devLog('[Notifications] createChannel no disponible:', e);
  }

  try {
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const url = action.notification.extra?.url as string | undefined;
      if (url && isSafeUrl(url)) window.location.href = url;
    });
  } catch (e) {
    devError('[Notifications] Error registrando listener:', e);
  }
}

export async function requestPermission(): Promise<boolean> {
  if (isNotificationsDisabled()) return false;

  if (!isNative()) {
    if (!('Notification' in window)) return false;
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch (e) {
      devError('[Notifications] Error web:', e);
      return false;
    }
  }

  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') return true;

    const result = await LocalNotifications.requestPermissions();
    if (result.display === 'granted') {
      toast.success('Notificaciones habilitadas correctamente');
      return true;
    }
    toast.error('Permiso de notificaciones denegado');
    return false;
  } catch (e) {
    devError('[Notifications] Error crítico en solicitud nativa:', e);
    toast.error('Error al solicitar permisos. Revisa los ajustes del sistema.');
    return false;
  }
}

/** Check síncrono (solo fiable en web; en nativo usa canNotifyAsync) */
export const canNotify = (): boolean => {
  if (isNotificationsDisabled()) return false;
  if (!isNative()) {
    if (!('Notification' in window)) return false;
    return Notification.permission === 'granted';
  }
  return true;
};

/** Check real de permisos en ambas plataformas. */
export async function canNotifyAsync(): Promise<boolean> {
  if (isNotificationsDisabled()) return false;
  if (!isNative()) return canNotify();
  try {
    const status = await LocalNotifications.checkPermissions();
    return status.display === 'granted';
  } catch {
    return false;
  }
}

export async function notify(
  title: string,
  options: NotificationOptions & { url?: string; id?: number },
): Promise<void> {
  if (!(await canNotifyAsync())) return;

  if (!isNative()) {
    try {
      const swRegistration = await navigator.serviceWorker?.ready;
      if (swRegistration && 'showNotification' in swRegistration) {
        await swRegistration.showNotification(title, {
          ...options,
          data: { url: options.url, ...options.data },
        });
      } else {
        const notification = new Notification(title, options);
        if (options.url) {
          notification.onclick = () => {
            if (options.url && isSafeUrl(options.url)) window.open(options.url, '_blank');
          };
        }
      }
    } catch {
      // falla silenciosamente
    }
    return;
  }

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body: options.body ?? '',
          id: options.id ?? NOTIF_IDS.GENERIC,
          channelId: 'reminders',
          extra: { url: options.url },
          schedule: { at: new Date(Date.now() + 100) },
        },
      ],
    });
  } catch (e) {
    devError('[Notifications] Error scheduling:', e);
  }
}

/* ── Timer de descanso ──────────────────────────────────────────────
   Alarma exacta programada al endTime: suena aunque la app esté en
   background o la pantalla apagada. Se cancela si el usuario para el
   timer o si la app (en foreground) ya avisó con sonido+haptic. */

/** +1.5s de margen: en foreground el tick del componente cancela antes de que dispare. */
const TIMER_FOREGROUND_GRACE_MS = 1500;

export async function scheduleTimerNotification(endAtMs: number): Promise<void> {
  if (!isNative()) return;
  if (!(await canNotifyAsync())) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_IDS.TIMER }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIF_IDS.TIMER,
          title: 'Descanso terminado',
          body: 'Siguiente serie. ¡A por ella! 💪',
          channelId: 'timer',
          extra: { url: '/' },
          schedule: { at: new Date(endAtMs + TIMER_FOREGROUND_GRACE_MS), allowWhileIdle: true },
        },
      ],
    });
  } catch (e) {
    devError('[Notifications] Error programando timer:', e);
  }
}

export async function cancelTimerNotification(): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_IDS.TIMER }] });
  } catch {
    // sin pendientes — nada que cancelar
  }
}

/* ── Recordatorios de rutina (semanales, repetitivos) ───────────────
   Programados en el sistema: disparan a las 18:30 del día con rutina
   aunque la app esté cerrada. Se re-sincronizan al cambiar la rutina
   activa y se cancelan al desactivar notificaciones. */

export interface ReminderDay {
  /** 1=domingo … 7=sábado (convención Capacitor) */
  weekday: number;
  routineName: string;
}

export async function syncRoutineReminders(days: ReminderDay[]): Promise<void> {
  if (!isNative()) return;
  try {
    // Cancelar siempre los 7 posibles antes de reprogramar
    await LocalNotifications.cancel({
      notifications: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
        id: NOTIF_IDS.ROUTINE_REMINDER_BASE + d,
      })),
    });

    if (days.length === 0 || !(await canNotifyAsync())) return;

    await LocalNotifications.schedule({
      notifications: days.map(({ weekday, routineName }) => ({
        id: NOTIF_IDS.ROUTINE_REMINDER_BASE + weekday,
        title: 'Hoy toca entrenar',
        body: `${routineName} te espera. ¿Empezamos?`,
        channelId: 'reminders',
        extra: { url: '/' },
        schedule: {
          on: { weekday: weekday as Weekday, hour: REMINDER_HOUR, minute: REMINDER_MINUTE },
          allowWhileIdle: true,
          repeats: true,
        },
      })),
    });
    devLog('[Notifications] Recordatorios sincronizados:', days.length);
  } catch (e) {
    devError('[Notifications] Error sincronizando recordatorios:', e);
  }
}

/* ── Racha en peligro — alarma nativa diaria ────────────────────────
   Se programa como notificación recurrente diaria a las 20:00.
   Dispara aunque la app esté cerrada. Cuando la app se abre y
   detecta que ya entrenó hoy, cancela la del día actual. */

export async function scheduleStreakReminder(): Promise<void> {
  if (!isNative()) return;
  if (!(await canNotifyAsync())) return;

  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_IDS.STREAK_DAILY }] });

    // Calcular próximo trigger: hoy a las 20:00, o mañana si ya pasó
    const now = new Date();
    const trigger = new Date(now);
    trigger.setHours(STREAK_HOUR, STREAK_MINUTE, 0, 0);
    if (trigger.getTime() <= now.getTime()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIF_IDS.STREAK_DAILY,
          title: '🔥 ¿Hoy no entrenas?',
          body: 'No pierdas tu racha. Un entrenamiento rápido cuenta.',
          channelId: 'reminders',
          extra: { url: '/' },
          schedule: {
            at: trigger,
            every: 'day',
            allowWhileIdle: true,
            repeats: true,
          },
        },
      ],
    });
    devLog('[Notifications] Racha diaria programada a las', STREAK_HOUR + ':' + STREAK_MINUTE);
  } catch (e) {
    devError('[Notifications] Error programando racha:', e);
  }
}

/** Cancela la notificación de racha del día (el usuario ya entrenó). */
export async function cancelStreakReminder(): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_IDS.STREAK_DAILY }] });
  } catch {
    // nada que cancelar
  }
}

/* ── Resumen semanal — alarma nativa los lunes ──────────────────────
   Notificación recurrente semanal los lunes a las 09:00. El body es
   genérico (no podemos consultar Supabase desde background nativo).
   Al abrir la app el lunes, se dispara una notificación inmediata
   con datos reales si aplica. */

export async function scheduleWeeklySummaryReminder(): Promise<void> {
  if (!isNative()) return;
  if (!(await canNotifyAsync())) return;

  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_IDS.WEEKLY_SUMMARY }] });

    // Capacitor weekday: 1=domingo, 2=lunes ... 7=sábado
    const MONDAY: Weekday = 2;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIF_IDS.WEEKLY_SUMMARY,
          title: '📊 Tu semana en GymLog',
          body: 'Revisa tu progreso de la semana pasada',
          channelId: 'reminders',
          extra: { url: '/stats' },
          schedule: {
            on: { weekday: MONDAY, hour: SUMMARY_HOUR, minute: SUMMARY_MINUTE },
            allowWhileIdle: true,
            repeats: true,
          },
        },
      ],
    });
    devLog(
      '[Notifications] Resumen semanal programado: lunes',
      SUMMARY_HOUR + ':' + SUMMARY_MINUTE,
    );
  } catch (e) {
    devError('[Notifications] Error programando resumen semanal:', e);
  }
}

/** Cancela todo lo programado (al desactivar notificaciones o cerrar sesión). */
export async function cancelAllScheduled(): Promise<void> {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }
  } catch (e) {
    devError('[Notifications] Error cancelando pendientes:', e);
  }
}
