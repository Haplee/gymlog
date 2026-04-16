import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { toast } from 'sonner';

export const isNative = (): boolean => Capacitor.isNativePlatform();

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
      console.error('[Notifications] Error web:', e);
      return false;
    }
  }

  try {
    console.log('[Notifications] Solicitando permisos nativos...');
    // Comprobamos estado actual
    const status = await LocalNotifications.checkPermissions();
    console.log('[Notifications] Estado actual:', status);
    
    if (status.display === 'granted') {
      return true;
    }

    // Solicitamos
    const result = await LocalNotifications.requestPermissions();
    console.log('[Notifications] Resultado solicitud:', result);
    
    if (result.display === 'granted') {
      toast.success('Notificaciones habilitadas correctamente');
      return true;
    } else {
      toast.error('Permiso de notificaciones denegado');
      return false;
    }
  } catch (e) {
    console.error('[Notifications] Error crítico en solicitud nativa:', e);
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
            if (options.url) window.open(options.url, '_blank');
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
    console.error('[Notifications] Error scheduling:', e);
  }
}

export async function registerNativeNotificationListeners(): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const url = action.notification.extra?.url as string | undefined;
      if (url) window.location.href = url;
    });
  } catch (e) {
    console.error('[Notifications] Error listener:', e);
  }
}
