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
 * Próxima fecha (>= ahora) para un weekday Capacitor (1=domingo … 7=sábado) a
 * la hora indicada. Si `skipToday` es true, o si hoy es ese weekday pero la hora
 * ya pasó, devuelve la ocurrencia de la semana siguiente. Se usa como punto de
 * inicio de una alarma repetitiva (`at` + `every`) para poder saltar el aviso de
 * hoy sin destruir la recurrencia semanal.
 */
function nextWeekdayDate(weekday: number, hour: number, minute: number, skipToday = false): Date {
  const now = new Date();
  const todayWeekday = now.getDay() + 1; // JS getDay 0=domingo → Capacitor 1=domingo
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);

  let deltaDays = (weekday - todayWeekday + 7) % 7;
  if (deltaDays === 0 && (skipToday || target.getTime() <= now.getTime())) {
    deltaDays = 7;
  }
  target.setDate(target.getDate() + deltaDays);
  return target;
}

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

/**
 * Permiso real del SO, sin mirar la preferencia del usuario. Sirve para no
 * pintar un toggle "activado" cuando el sistema no deja que llegue nada.
 * `canNotifyAsync` es lo que hay que usar para decidir si notificar.
 */
export async function hasOsNotificationPermission(): Promise<boolean> {
  if (!isNative()) {
    if (!('Notification' in window)) return false;
    return Notification.permission === 'granted';
  }
  try {
    const status = await LocalNotifications.checkPermissions();
    return status.display === 'granted';
  } catch {
    return false;
  }
}

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

/* ── Alarmas exactas (Android 12+) ──────────────────────────────────
   Sin este permiso, el plugin cae a `setAndAllowWhileIdle`, que el sistema
   entrega con una ventana de ~46s: medido, el aviso de descanso llegaba ~19s
   tarde. Con el permiso usa `setExactAndAllowWhileIdle` y llega puntual.
   (Ver LocalNotificationManager.setExactIfPossible en el plugin.)

   Declaramos SCHEDULE_EXACT_ALARM en el manifest, pero desde Android 14 ya no
   se autoconcede: hay que mandar al usuario a los ajustes del sistema. */

/** `true` si el sistema nos deja programar alarmas exactas (siempre en <Android 12 y en iOS). */
export async function canScheduleExactAlarms(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
    return exact_alarm === 'granted';
  } catch {
    // iOS / plataformas sin la API: no aplica, no bloquear nada por esto.
    return true;
  }
}

/**
 * Abre los ajustes del sistema para conceder alarmas exactas. Saca al usuario
 * de la app, así que solo debe invocarse desde una acción explícita suya.
 * Devuelve el estado resultante.
 */
export async function requestExactAlarms(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const { exact_alarm } = await LocalNotifications.changeExactNotificationSetting();
    return exact_alarm === 'granted';
  } catch (e) {
    devError('[Notifications] Error pidiendo alarmas exactas:', e);
    return false;
  }
}

/* ── Timer de descanso ──────────────────────────────────────────────
   Alarma programada al endTime: suena aunque la app esté en background o la
   pantalla apagada. Será exacta solo si el usuario concedió el permiso de
   alarmas exactas (ver arriba); si no, puede llegar con retraso. Se cancela si
   el usuario para el timer o si la app (en foreground) ya avisó con
   sonido+haptic. */

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
          // Persistente: no se va sola ni con un swipe. El usuario tiene que
          // tocarla (o parar la alarma en la app) — es una alarma, no un aviso.
          ongoing: true,
          autoCancel: false,
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

/* ── Copys de los avisos ────────────────────────────────────────────
   Pools de mensajes: se elige uno al azar en cada (re)programación para
   que las notificaciones no sean siempre idénticas. Textos en español
   fijos a propósito: las alarmas disparan desde background nativo, donde
   i18next puede no estar cargado. */

interface ReminderCopy {
  title: string;
  body: string;
}

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Copy del recordatorio de rutina del día. `routineName` es el nombre del día
    de la rutina activa (p. ej. "Push (Pecho + Hombro + Tríceps)"). */
export function getRoutineReminderCopy(routineName: string): ReminderCopy {
  const variants: readonly ((r: string) => ReminderCopy)[] = [
    (r) => ({ title: 'Hoy toca entrenar', body: `${r} te espera. ¿Empezamos?` }),
    (r) => ({ title: '💪 A darlo todo', body: `Tienes ${r} pendiente. Sin excusas.` }),
    (r) => ({ title: '🏋️ Hora de moverse', body: `Toca ${r}. Una hora y a por ello.` }),
    (r) => ({ title: 'Tu rutina te llama', body: `${r} no se hace sola. ¡Vamos!` }),
    (r) => ({ title: 'No rompas el ritmo', body: `${r} hoy. Tu yo del futuro lo agradecerá.` }),
    (r) => ({ title: '🔥 Modo bestia', body: `${r} en el menú de hoy. Dale caña.` }),
  ];
  return pick(variants)(routineName);
}

/** Copy de la alerta de racha en peligro. */
export function getStreakReminderCopy(): ReminderCopy {
  const variants: readonly ReminderCopy[] = [
    { title: '🔥 ¿Hoy no entrenas?', body: 'No pierdas tu racha. Un entrenamiento rápido cuenta.' },
    { title: '🔥 Tu racha está en juego', body: 'Aún estás a tiempo. Que no se apague hoy.' },
    { title: '⏳ Quedan horas', body: 'Mantén viva la racha con una sesión corta.' },
    { title: '🔥 No lo dejes para mañana', body: 'Unos minutos bastan para conservar tu racha.' },
    { title: '💯 Sigue la cadena', body: 'Cada día suma. No cortes la racha justo hoy.' },
  ];
  return pick(variants);
}

/** Copy del resumen semanal (lunes). */
export function getWeeklySummaryCopy(): ReminderCopy {
  const variants: readonly ReminderCopy[] = [
    { title: '📊 Tu semana en GymLog', body: 'Revisa tu progreso de la semana pasada' },
    { title: '📈 Nuevo lunes, nuevos retos', body: 'Mira cómo fue tu última semana y planifica' },
    { title: '📊 Resumen semanal listo', body: 'Volumen, PRs y rachas de los últimos 7 días' },
  ];
  return pick(variants);
}

export async function syncRoutineReminders(
  days: ReminderDay[],
  trainedToday = false,
): Promise<void> {
  if (!isNative()) return;
  try {
    // Cancelar siempre los 7 posibles antes de reprogramar
    await LocalNotifications.cancel({
      notifications: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
        id: NOTIF_IDS.ROUTINE_REMINDER_BASE + d,
      })),
    });

    if (days.length === 0 || !(await canNotifyAsync())) return;

    const todayWeekday = new Date().getDay() + 1;

    await LocalNotifications.schedule({
      notifications: days.map(({ weekday, routineName }) => {
        // Si ya entrenó hoy, el aviso del día se salta a la semana siguiente:
        // así no dice "hoy toca entrenar" cuando ya se ha entrenado, pero la
        // recurrencia semanal se mantiene intacta.
        const skipToday = trainedToday && weekday === todayWeekday;
        const at = nextWeekdayDate(weekday, REMINDER_HOUR, REMINDER_MINUTE, skipToday);
        const copy = getRoutineReminderCopy(routineName);
        return {
          id: NOTIF_IDS.ROUTINE_REMINDER_BASE + weekday,
          title: copy.title,
          body: copy.body,
          channelId: 'reminders',
          extra: { url: '/' },
          schedule: {
            at,
            every: 'week' as const,
            allowWhileIdle: true,
            repeats: true,
          },
        };
      }),
    });
    devLog(
      '[Notifications] Recordatorios sincronizados:',
      days.length,
      'trainedToday:',
      trainedToday,
    );
  } catch (e) {
    devError('[Notifications] Error sincronizando recordatorios:', e);
  }
}

/* ── Racha en peligro — alarma nativa diaria ────────────────────────
   Se programa como notificación recurrente diaria a las 20:00.
   Dispara aunque la app esté cerrada. Cuando la app se abre y
   detecta que ya entrenó hoy, cancela la del día actual. */

export async function scheduleStreakReminder(trainedToday = false): Promise<void> {
  if (!isNative()) return;
  if (!(await canNotifyAsync())) return;

  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_IDS.STREAK_DAILY }] });

    // Calcular próximo trigger: hoy a las 20:00; se salta a mañana si ya pasó la
    // hora o si ya se ha entrenado hoy (así no avisa "¿hoy no entrenas?" tras
    // haber entrenado, y la serie diaria sigue viva para los próximos días).
    const now = new Date();
    const trigger = new Date(now);
    trigger.setHours(STREAK_HOUR, STREAK_MINUTE, 0, 0);
    if (trainedToday || trigger.getTime() <= now.getTime()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    const copy = getStreakReminderCopy();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIF_IDS.STREAK_DAILY,
          title: copy.title,
          body: copy.body,
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
    const copy = getWeeklySummaryCopy();

    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIF_IDS.WEEKLY_SUMMARY,
          title: copy.title,
          body: copy.body,
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
