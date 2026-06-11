import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { toast } from 'sonner';
import { devError, devLog } from '@shared/lib/devtools';

export const isNative = (): boolean => Capacitor.isNativePlatform();

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
    devLog('[Notifications] Solicitando permisos nativos...');
    // Comprobamos estado actual
    const status = await LocalNotifications.checkPermissions();
    devLog('[Notifications] Estado actual:', status);

    if (status.display === 'granted') {
      return true;
    }

    // Solicitamos
    const result = await LocalNotifications.requestPermissions();
    devLog('[Notifications] Resultado solicitud:', result);

    if (result.display === 'granted') {
      toast.success('Notificaciones habilitadas correctamente');
      return true;
    } else {
      toast.error('Permiso de notificaciones denegado');
      return false;
    }
  } catch (e) {
    devError('[Notifications] Error crítico en solicitud nativa:', e);
    toast.error('Error al solicitar permisos. Revisa los ajustes del sistema.');
    return false;
  }
}

export const canNotify = (): boolean => {
  if (isNotificationsDisabled()) return false;
  if (!isNative()) {
    if (!('Notification' in window)) return false;
    return Notification.permission === 'granted';
  }
  return true;
};

export async function notify(
  title: string,
  options: NotificationOptions & { url?: string },
): Promise<void> {
  if (isNotificationsDisabled()) return;

  if (!isNative()) {
    if (!canNotify()) return;
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
          id: Date.now() % 2147483647,
          extra: { url: options.url },
          schedule: { at: new Date(Date.now() + 100) },
        },
      ],
    });
  } catch (e) {
    devError('[Notifications] Error scheduling:', e);
  }
}

export async function notifyTimerAlarm(seconds: number): Promise<void> {
  if (isNotificationsDisabled()) return;

  if (!isNative()) {
    if (!canNotify()) return;
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker?.ready;
        if (registration) {
          await registration.showNotification('GymLog - Descanso terminado', {
            body: `Han pasado ${seconds} segundos de descanso`,
            tag: 'timer-alarm',
            requireInteraction: true,
          });
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
          title: 'GymLog - Descanso terminado',
          body: `Han pasado ${seconds} segundos`,
          id: 999999,
          schedule: { at: new Date(Date.now() + 100) },
        },
      ],
    });
  } catch (e) {
    devError('[Notifications] Timer alarm error:', e);
  }
}

export async function playAlarmSound(): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = i === 1 ? 880 : 660;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.8, ctx.currentTime + i * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.3 + 0.25);
      osc.start(ctx.currentTime + i * 0.3);
      osc.stop(ctx.currentTime + i * 0.3 + 0.25);
    }
  } catch (e) {
    devError('[Alarm] Sound error:', e);
  }
}

export async function registerNativeNotificationListeners(): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const url = action.notification.extra?.url as string | undefined;
      if (url && isSafeUrl(url)) window.location.href = url;
    });
  } catch (e) {
    devError('[Notifications] Error listener:', e);
  }
}
