import { registerPlugin } from '@capacitor/core';

export interface BiometricPlugin {
  checkBiometry(): Promise<{ available: boolean; status: number; message: string }>;
  authenticate(): Promise<{ success: boolean; message?: string; code?: number }>;
  setBiometricEnabled(options: { enabled: boolean }): Promise<void>;
}

const BiometricPlugin = registerPlugin<BiometricPlugin>('BiometricPlugin', {
  // Fallback en web/PWA: evita el error UNIMPLEMENTED cuando no hay capa nativa.
  web: () => ({
    checkBiometry: async () => ({ available: false, status: -1, message: 'No disponible en web' }),
    authenticate: async () => ({ success: false, message: 'No disponible en web' }),
    setBiometricEnabled: async (_options: { enabled: boolean }) => {},
  }),
});

export default BiometricPlugin;
