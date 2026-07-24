import { registerPlugin, Capacitor } from '@capacitor/core';
import { ACCENT_PRESETS } from '@shared/constants/accents';

/**
 * Cambia el icono del lanzador (solo Android nativo).
 *
 * En web/PWA el icono lo fija el manifest al instalar y no se puede tocar, así
 * que el fallback no hace nada y `isAppIconSupported` deja la fila fuera de
 * Ajustes en vez de ofrecer un control que no responde.
 */
export interface AppIconPlugin {
  /** Activa el alias `id` y apaga los de `all`. */
  setIcon(options: { id: string; all: string[] }): Promise<{ ok: boolean }>;
}

const AppIcon = registerPlugin<AppIconPlugin>('AppIcon', {
  web: () => ({
    setIcon: async () => ({ ok: false }),
  }),
});

export const isAppIconSupported = (): boolean => Capacitor.getPlatform() === 'android';

/** Ids de todos los alias declarados en el manifest, en el mismo orden. */
export const APP_ICON_IDS = ACCENT_PRESETS.map((a) => a.id);

export async function setAppIcon(id: string): Promise<void> {
  await AppIcon.setIcon({ id, all: APP_ICON_IDS });
}

export default AppIcon;
