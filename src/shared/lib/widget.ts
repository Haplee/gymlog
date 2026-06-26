import { Capacitor, registerPlugin } from '@capacitor/core';
import { devError } from './devtools';

interface WidgetBridgePlugin {
  update(opts: { streak: number; lastLabel: string }): Promise<{ ok: boolean }>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

/**
 * Envía racha + último entreno al widget Android. No-op en web/iOS o si el
 * plugin nativo no está disponible.
 */
export async function updateWidget(streak: number, lastLabel: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.update({ streak, lastLabel });
  } catch (err) {
    // plugin no disponible (p.ej. iOS) — no romper, pero dejar rastro en dev.
    devError('[widget] update failed:', err);
  }
}
