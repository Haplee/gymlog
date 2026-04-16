import { registerPlugin } from '@capacitor/core';

export interface BiometricPlugin {
  checkBiometry(): Promise<{ available: boolean; status: number; message: string }>;
  authenticate(): Promise<{ success: boolean; message?: string; code?: number }>;
  setBiometricEnabled(options: { enabled: boolean }): Promise<void>;
}

const BiometricPlugin = registerPlugin<BiometricPlugin>('BiometricPlugin');

export default BiometricPlugin;
