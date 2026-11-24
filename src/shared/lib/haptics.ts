import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export { ImpactStyle, NotificationType };

type VibrationPattern = number | number[];

const IMPACT_PATTERNS: Record<ImpactStyle, VibrationPattern> = {
  [ImpactStyle.Light]: 8,
  [ImpactStyle.Medium]: 18,
  [ImpactStyle.Heavy]: 30,
};

const NOTIFICATION_PATTERNS: Record<NotificationType, VibrationPattern> = {
  [NotificationType.Success]: [15, 40, 30],
  [NotificationType.Warning]: [30, 40, 30],
  [NotificationType.Error]: [60, 40, 60],
};

function vibrateOnWeb(pattern: VibrationPattern): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

  try {
    navigator.vibrate(pattern);
  } catch {
    // La API de vibración es opcional y algunos navegadores la bloquean.
  }
}

export const impact = async (style: ImpactStyle = ImpactStyle.Medium): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    vibrateOnWeb(IMPACT_PATTERNS[style]);
    return;
  }

  try {
    await Haptics.impact({ style });
  } catch {
    vibrateOnWeb(IMPACT_PATTERNS[style]);
  }
};

export const notificationHaptic = async (type: NotificationType): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    vibrateOnWeb(NOTIFICATION_PATTERNS[type]);
    return;
  }

  try {
    await Haptics.notification({ type });
  } catch {
    vibrateOnWeb(NOTIFICATION_PATTERNS[type]);
  }
};

/** Toque breve al editar una serie. */
export const tapSet = (): Promise<void> => impact(ImpactStyle.Light);

/** Confirmación táctil al completar una serie. */
export const completeSet = (): Promise<void> => impact(ImpactStyle.Medium);

/** Confirmación al poner en marcha un temporizador. */
export const startTimer = (): Promise<void> => impact(ImpactStyle.Heavy);

/** Aviso háptico cuando termina el temporizador. */
export const timerDone = (): Promise<void> => notificationHaptic(NotificationType.Warning);

/** Celebración háptica de un nuevo récord personal. */
export const newPR = (): Promise<void> => notificationHaptic(NotificationType.Success);
