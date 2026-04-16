import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export { ImpactStyle, NotificationType };

export const impact = async (style: ImpactStyle = ImpactStyle.Medium): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  await Haptics.impact({ style });
};

export const notificationHaptic = async (type: NotificationType): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  await Haptics.notification({ type });
};
