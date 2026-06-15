import { Capacitor } from '@capacitor/core';
import { supabase } from '@shared/lib/supabase';
import { isNotificationsDisabled } from '@shared/lib/notifications';
import { devError, devLog } from '@shared/lib/devtools';

/**
 * Push remoto (FCM vía @capacitor/push-notifications).
 *
 * - Solo nativo. En web no hay registro (las notificaciones web siguen siendo
 *   locales, gestionadas en notifications.ts).
 * - Respeta el flag de notificaciones: si el usuario las desactivó, no registra.
 * - El token se sube a la tabla push_tokens (upsert por token). La edge function
 *   `send-push` lo consume con service_role para enviar.
 */

let _listenersBound = false;
let _currentUserId: string | null = null;

/** Sube/refresca el token del dispositivo para el usuario actual. */
async function upsertToken(token: string, userId: string): Promise<void> {
  const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token, platform }, { onConflict: 'token' });
  if (error) devError('[Push] Error guardando token:', error.message);
  else devLog('[Push] Token registrado');
}

/**
 * Registra el dispositivo para push remoto. Idempotente: los listeners se
 * enlazan una sola vez; en arranques posteriores solo refresca el userId y
 * vuelve a llamar a register() para obtener el token vigente.
 */
export async function registerPushNotifications(userId: string): Promise<void> {
  // IMPORTANTE: PushNotifications.register() llama a FirebaseMessaging.getInstance(),
  // que CRASHEA la app de forma nativa si no hay google-services.json
  // (IllegalStateException: Default FirebaseApp is not initialized). El try/catch
  // de JS no puede capturarlo. Hasta configurar Firebase, mantener este flag a
  // 'false' (env VITE_PUSH_ENABLED). Ver supabase/functions/send-push/README.md.
  if (import.meta.env.VITE_PUSH_ENABLED !== 'true') return;
  if (!Capacitor.isNativePlatform()) return;
  if (isNotificationsDisabled()) return;
  if (!userId) return;

  _currentUserId = userId;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const perm = await PushNotifications.checkPermissions();
    let receive = perm.receive;
    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      receive = (await PushNotifications.requestPermissions()).receive;
    }
    if (receive !== 'granted') {
      devLog('[Push] Permiso de push no concedido');
      return;
    }

    if (!_listenersBound) {
      _listenersBound = true;

      await PushNotifications.addListener('registration', (token) => {
        if (_currentUserId) void upsertToken(token.value, _currentUserId);
      });

      await PushNotifications.addListener('registrationError', (err) => {
        devError('[Push] Error de registro:', JSON.stringify(err));
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const url = action.notification.data?.url as string | undefined;
        if (url && url.startsWith('/')) window.location.href = url;
      });
    }

    await PushNotifications.register();
  } catch (e) {
    devError('[Push] Error inicializando push:', e);
  }
}

/** Elimina el token del dispositivo actual (p.ej. al desactivar notificaciones). */
export async function unregisterPushToken(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    // Intenta leer el token actual no es trivial sin re-registrar; borramos por
    // userId los tokens de esta plataforma como aproximación segura.
    if (_currentUserId) {
      await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', _currentUserId)
        .eq('platform', Capacitor.getPlatform());
    }
    await PushNotifications.removeAllListeners();
    _listenersBound = false;
  } catch (e) {
    devError('[Push] Error al desregistrar push:', e);
  }
}
