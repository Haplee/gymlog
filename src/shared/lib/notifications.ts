export const isNotificationsDisabled = () => localStorage.getItem('notif_disabled') === 'true';

export const requestPermission = async (): Promise<NotificationPermission | 'default'> => {
  if (isNotificationsDisabled()) return 'denied';
  if (!('Notification' in window)) return 'denied';

  try {
    const permission = await Notification.requestPermission();
    localStorage.setItem('notif_permission', permission);
    return permission;
  } catch {
    return 'denied';
  }
};

export const canNotify = (): boolean => {
  if (isNotificationsDisabled()) return false;
  if (!('Notification' in window)) return false;
  return Notification.permission === 'granted' && document.visibilityState !== 'visible';
};

export const notify = async (
  title: string,
  options: NotificationOptions & { url?: string },
): Promise<void> => {
  if (!canNotify()) return;

  try {
    const swRegistration = await navigator.serviceWorker?.ready;

    if (swRegistration && 'showNotification' in swRegistration) {
      // Show notification via service worker
      await swRegistration.showNotification(title, {
        ...options,
        data: { url: options.url, ...options.data },
      });
    } else {
      // Fallback to basic notification
      const notification = new Notification(title, options);
      if (options.url) {
        notification.onclick = () => {
          if (options.url) {
            window.open(options.url, '_blank');
          }
        };
      }
    }
  } catch {
    // Falla silenciosamente según las reglas
  }
};
