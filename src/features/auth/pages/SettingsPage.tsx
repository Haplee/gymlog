import { useEffect, useState, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { Layout } from '@app/components/Layout';
import { SectionHeader, SegmentedControl, Toggle } from '@shared/components/ui';
import { supabase } from '@shared/lib/supabase';
import { App as CapApp } from '@capacitor/app';
import {
  requestPermission,
  isNative,
  cancelAllScheduled,
  scheduleWeeklySummaryReminder,
  canScheduleExactAlarms,
  requestExactAlarms,
  hasOsNotificationPermission,
} from '@shared/lib/notifications';
import { reconcileReminders } from '@shared/lib/reminderReconcile';
import { registerPushNotifications, unregisterPushToken } from '@shared/lib/push';
import { useUpdateProfileCache } from '@features/auth/hooks/useProfile';
import { toast } from 'sonner';
import BiometricPlugin from '@shared/lib/biometric';
import { devError } from '@shared/lib/devtools';
import { Camera, Check, ChevronRight, Download, Loader2, LogOut, Pencil, X } from 'lucide-react';
import { IconBook, IconRuler, IconWatch } from '@shared/components/icons';
import { ACCENT_PRESETS } from '@shared/constants/accents';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_NAME_LENGTH = 40;

const playSound = (freq: number, duration: number, delay: number, ctx: AudioContext) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'square';
  gain.gain.setValueAtTime(0.9, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
};

/**
 * Fila de menú del kit FitBody: icono dentro de un círculo de acento, etiqueta
 * y chevron. Es el patrón de su pantalla de perfil (Profile, Favorite, Help…).
 */
function MenuRow({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 min-h-11 py-2 text-left active:opacity-70"
    >
      <span className="flex items-center gap-3 text-sm text-fg">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
          {icon}
        </span>
        {label}
      </span>
      <ChevronRight className="w-4 h-4 text-fg-subtle" />
    </button>
  );
}

function SettingRow({
  label,
  desc,
  control,
  divider = true,
}: {
  label: string;
  desc?: string;
  control: ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3.5 ${
        divider ? 'dotted-separator' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="text-base text-fg">{label}</div>
        {desc && <div className="text-xs mt-0.5 text-fg-subtle">{desc}</div>}
      </div>
      <div className="flex-shrink-0">{control}</div>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const {
    sound,
    setSound,
    language,
    setLanguage,
    theme,
    setTheme,
    biometricEnabled,
    setBiometricEnabled,
    notificationsEnabled,
    setNotificationsEnabled,
    trainingReminders,
    setTrainingReminders,
    unitSystem,
    setUnitSystem,
    showWarmupSets,
    setShowWarmupSets,
    restAutoStart,
    setRestAutoStart,
    restDuration,
    setRestDuration,
    restByExercise,
    setRestByExercise,
    accentColor,
    setAccentColor,
  } = useSettingsStore();
  const [biometricSupport, setBiometricSupport] = useState<{ available: boolean; message: string }>(
    { available: false, message: '' },
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  /** `null` = aún sin comprobar; no pintar la fila hasta saberlo. */
  const [exactAlarmsGranted, setExactAlarmsGranted] = useState<boolean | null>(null);
  const updateProfileCache = useUpdateProfileCache();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchConfig = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('notifications_enabled, avatar_url, full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (data) {
        // La preferencia guardada no basta: si el SO tiene el permiso denegado
        // no puede llegar ninguna notificación, así que el toggle mentiría.
        const osGranted = await hasOsNotificationPermission();
        // setNotificationsEnabled espeja el flag en localStorage internamente
        setNotificationsEnabled(!!data.notifications_enabled && osGranted);
        setAvatarUrl(data.avatar_url);
        setFullName(data.full_name ?? '');
      }
    };

    const checkBio = async () => {
      if (isNative()) {
        try {
          const support = await BiometricPlugin.checkBiometry();
          setBiometricSupport({ available: support.available, message: support.message || '' });
          // Si el hardware dice que no está activado, pero el store dice que sí, sincronizamos
          if (!support.available && biometricEnabled) {
            setBiometricEnabled(false);
            await BiometricPlugin.setBiometricEnabled({ enabled: false });
          }
        } catch (e: unknown) {
          devError('Error checking biometric:', e);
          const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
          setBiometricSupport({
            available: false,
            message: `Error de conexión nativa: ${errorMsg}. Asegúrate de haber compilado el APK con el nuevo código.`,
          });
        }
      }
    };

    fetchConfig();
    checkBio();
  }, [user, navigate, biometricEnabled, setBiometricEnabled, setNotificationsEnabled]);

  const playFeedbackSound = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      playSound(1200, 0.25, 0, ctx);
      playSound(1500, 0.25, 0.15, ctx);
      playSound(1800, 0.35, 0.3, ctx);
    } catch (e) {
      devError('[Sound] Error:', e);
    }
  }, []);

  const handlePushToggle = async () => {
    const newValue = !notificationsEnabled;
    if (newValue) {
      // Habilita temporalmente para que requestPermission no se autobloquee
      setNotificationsEnabled(true);

      if (!isNative() && 'Notification' in window && Notification.permission === 'denied') {
        setNotificationsEnabled(false);
        toast.error(t('settings.notif_denied_browser'));
        return;
      }

      const granted = await requestPermission();
      if (granted) {
        if (user) {
          // upsert: crea la fila de perfil si no existe (un UPDATE sobre 0
          // filas "triunfa" sin guardar nada — así se perdían los ajustes).
          await supabase
            .from('profiles')
            .upsert({ id: user.id, notifications_enabled: true }, { onConflict: 'id' });
        }
        // Reprogramar todas las alarmas nativas con el permiso ya concedido
        if (user) await reconcileReminders(user.id);
        await scheduleWeeklySummaryReminder();
        // Registrar token push remoto
        if (user) void registerPushNotifications(user.id);
        toast.success(t('settings.notif_on'));
      } else {
        setNotificationsEnabled(false);
        toast.error(t('settings.notif_denied'));
      }
    } else {
      setNotificationsEnabled(false);
      if (user) {
        await supabase
          .from('profiles')
          .upsert({ id: user.id, notifications_enabled: false }, { onConflict: 'id' });
      }
      // Sin notificaciones: limpiar todo lo programado en el sistema
      await cancelAllScheduled();
      // Y eliminar el token push remoto del dispositivo
      await unregisterPushToken();
    }
  };

  // El ajuste solo persiste una preferencia: sin reconciliar, las alarmas ya
  // programadas seguirían sonando (o no volverían) hasta el siguiente arranque.
  const handleTrainingRemindersToggle = async (enabled: boolean) => {
    setTrainingReminders(enabled);
    if (user) await reconcileReminders(user.id);
  };

  // El permiso de alarmas exactas se concede fuera de la app (ajustes del
  // sistema), así que hay que re-comprobarlo al volver, no solo al montar.
  useEffect(() => {
    if (!isNative()) return;

    const refresh = () => void canScheduleExactAlarms().then(setExactAlarmsGranted);
    refresh();

    const handle = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) refresh();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);

  const handleExactAlarmsRequest = async () => {
    const granted = await requestExactAlarms();
    setExactAlarmsGranted(granted);
    if (granted) {
      // Las alarmas ya programadas se re-registran inexactas: reprogramar para
      // que pasen a exactas.
      if (user) await reconcileReminders(user.id);
      toast.success(t('settings.exact_alarms_on'));
    }
  };

  const handleBiometricToggle = async () => {
    if (!isNative()) return;

    if (!biometricSupport.available) {
      toast.error(t('settings.biometric_unavailable', { message: biometricSupport.message }));
      return;
    }

    if (!biometricEnabled) {
      const loadId = toast.loading(t('settings.biometric_verifying'));
      try {
        const result = await BiometricPlugin.authenticate();
        if (result.success) {
          setBiometricEnabled(true);
          await BiometricPlugin.setBiometricEnabled({ enabled: true });
          toast.success(t('settings.biometric_on'), { id: loadId });
        } else {
          toast.error(result.message || t('settings.biometric_failed'), { id: loadId });
        }
      } catch (e) {
        toast.error(t('settings.biometric_sensor_error'), { id: loadId });
        devError('Error biometric:', e);
      }
    } else {
      setBiometricEnabled(false);
      await BiometricPlugin.setBiometricEnabled({ enabled: false });
      toast.success(t('settings.biometric_off'));
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('settings.photo_error'));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t('settings.photo_too_large'));
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path);
      // upsert: crea la fila de perfil si no existe (un UPDATE sobre 0 filas
      // "triunfa" sin guardar nada — así se perdía la foto al recargar).
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, avatar_url: publicData.publicUrl }, { onConflict: 'id' });
      if (updateError) throw updateError;

      // Limpieza best-effort del avatar anterior (solo si vivía en nuestro bucket)
      const previousPath = avatarUrl?.split('/avatars/')[1];
      if (previousPath && previousPath !== path) {
        void supabase.storage.from('avatars').remove([decodeURIComponent(previousPath)]);
      }

      setAvatarUrl(publicData.publicUrl);
      updateProfileCache(user.id, { avatarUrl: publicData.publicUrl });
      toast.success(t('settings.photo_updated'));
    } catch (err) {
      devError('[Avatar] Error subiendo imagen:', err);
      toast.error(t('settings.photo_error'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleNameSave = async () => {
    if (!user) return;
    const trimmed = nameDraft.trim().slice(0, MAX_NAME_LENGTH);
    if (!trimmed || trimmed === fullName) {
      setIsEditingName(false);
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, full_name: trimmed }, { onConflict: 'id' });
    if (error) {
      devError('[Perfil] Error guardando nombre:', error);
      toast.error(t('settings.name_error'));
      return;
    }
    setFullName(trimmed);
    updateProfileCache(user.id, { fullName: trimmed });
    setIsEditingName(false);
    toast.success(t('settings.name_updated'));
  };

  const emailName = user?.email?.split('@')[0] ?? '';
  const displayName = fullName || emailName;
  const isGoogle = user?.app_metadata?.provider === 'google';

  return (
    <Layout>
      <div className="space-y-6 pb-20">
        {/* Perfil */}
        {/* Cabecera de perfil del kit ("Progress Tracking"): banda rellena del
            acento con el avatar circular y el nombre en grande. */}
        <div className="rounded-card overflow-hidden bg-surface border border-line">
          <div className="flex items-center gap-3 bg-accent p-4">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              aria-label={t('settings.change_photo')}
              className="relative w-14 h-14 flex-shrink-0 rounded-full active:scale-95 transition-transform disabled:opacity-60"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover border-2 border-accent-fg/20"
                />
              ) : (
                <span className="w-14 h-14 rounded-full flex items-center justify-center bg-accent-fg text-accent font-display font-bold text-lg uppercase">
                  {displayName.slice(0, 1) || '?'}
                </span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center bg-canvas text-accent">
                {isUploadingAvatar ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <div className="min-w-0 flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleNameSave();
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                    maxLength={MAX_NAME_LENGTH}
                    placeholder={t('settings.name_placeholder')}
                    ref={(el) => el?.focus()}
                    aria-label={t('settings.edit_name')}
                    className="min-w-0 flex-1 bg-transparent border-0 border-b border-line-strong focus:border-accent outline-none text-data font-display font-bold text-fg py-0.5"
                  />
                  <button
                    type="button"
                    onClick={() => void handleNameSave()}
                    aria-label={t('common.save')}
                    className="w-11 h-11 -my-2 flex-shrink-0 flex items-center justify-center text-accent"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(false)}
                    aria-label={t('common.cancel')}
                    className="w-11 h-11 -my-2 -ml-2 flex-shrink-0 flex items-center justify-center text-fg-subtle"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center min-w-0">
                  <div className="text-data font-display font-bold text-accent-fg truncate">
                    {displayName}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(fullName || emailName);
                      setIsEditingName(true);
                    }}
                    aria-label={t('settings.edit_name')}
                    className="w-11 h-11 -my-2 flex-shrink-0 flex items-center justify-center text-accent-fg/75 active:text-accent-fg"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="text-xs text-accent-fg/85 truncate">{user?.email}</div>
            </div>
          </div>

          {/* Menú del kit: cada fila con su icono en un círculo de acento. */}
          <div className="p-4">
            {isGoogle && (
              <span className="label-caps inline-block mb-3 px-2.5 py-1 rounded-pill bg-surface-2 text-fg-muted">
                {t('settings.google_account')}
              </span>
            )}
            <MenuRow
              icon={<IconRuler className="w-4 h-4" />}
              label={t('settings.my_measurements')}
              onClick={() => navigate('/user-stats')}
            />
            <MenuRow
              icon={<IconBook className="w-4 h-4" />}
              label={t('guide.title')}
              onClick={() => navigate('/guide')}
            />
          </div>
        </div>

        {!isNative() && (
          <a
            href="https://github.com/Haplee/gymlog/releases/download/v0.5.0/GymLog-v0.5.0.apk"
            download
            className="flex items-center justify-center gap-2 rounded-sm p-3.5 border text-center bg-surface border-line-accent text-accent transition-transform active:scale-[0.99]"
          >
            <Download className="w-4 h-4" />
            <span className="label-caps">{t('settings.download_apk_title')}</span>
          </a>
        )}

        {/* Preferencias */}
        <section>
          <SectionHeader title={t('settings.preferences')} />
          <div className="rounded-card bg-surface border border-line overflow-hidden">
            <SettingRow
              label={t('settings.language')}
              control={
                <SegmentedControl
                  options={[
                    { value: 'es', label: 'ES' },
                    { value: 'en', label: 'EN' },
                  ]}
                  value={language as 'es' | 'en'}
                  onChange={(v) => setLanguage(v)}
                  ariaLabel={t('settings.language')}
                />
              }
            />
            <SettingRow
              label={t('settings.theme')}
              control={
                <SegmentedControl
                  options={[
                    { value: 'dark', label: t('settings.theme_dark') },
                    { value: 'light', label: t('settings.theme_light') },
                  ]}
                  value={theme}
                  onChange={(v) => setTheme(v)}
                  ariaLabel={t('settings.theme')}
                />
              }
            />

            {/* El color de acento va en su propia fila: nueve muestras no caben
                en el hueco del control de una SettingRow. */}
            <div className="dotted-separator px-4 py-3.5">
              <div className="text-base text-fg">{t('settings.accent')}</div>
              <div className="text-xs mt-0.5 text-fg-subtle">{t('settings.accent_desc')}</div>
              <div
                role="radiogroup"
                aria-label={t('settings.accent')}
                className="mt-3 flex flex-wrap gap-2.5"
              >
                {ACCENT_PRESETS.map((preset) => {
                  const isActive = preset.id === accentColor;
                  const swatch = preset[theme].primary;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={t(`settings.accent_${preset.id}`)}
                      onClick={() => setAccentColor(preset.id)}
                      className={`h-11 w-11 rounded-full transition-transform active:scale-95 ${
                        isActive ? 'ring-2 ring-offset-2 ring-offset-surface ring-fg' : ''
                      }`}
                      style={{ backgroundColor: swatch }}
                    >
                      {isActive && (
                        <Check
                          className="mx-auto h-4 w-4"
                          style={{ color: preset[theme].fg }}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <SettingRow
              label={t('settings.weight_unit')}
              control={
                <SegmentedControl
                  options={[
                    { value: 'kg', label: 'KG' },
                    { value: 'lb', label: 'LB' },
                  ]}
                  value={unitSystem}
                  onChange={(v) => setUnitSystem(v)}
                  ariaLabel={t('settings.weight_unit')}
                />
              }
            />
            <SettingRow
              label={t('settings.sound')}
              desc={t('settings.sound_desc')}
              control={
                <Toggle
                  checked={sound}
                  onChange={(v) => {
                    setSound(v);
                    if (v) playFeedbackSound();
                  }}
                  ariaLabel={t('settings.sound')}
                />
              }
            />
            <SettingRow
              label={t('settings.warmup_sets')}
              desc={t('settings.warmup_sets_desc')}
              control={
                <Toggle
                  checked={showWarmupSets}
                  onChange={setShowWarmupSets}
                  ariaLabel={t('settings.warmup_sets')}
                />
              }
              divider={false}
            />
          </div>
        </section>

        {/* Entrenamiento */}
        <section>
          <SectionHeader title={t('settings.training')} />
          <div className="rounded-card bg-surface border border-line overflow-hidden">
            <SettingRow
              label={t('settings.training_reminders')}
              desc={t('settings.training_reminders_desc')}
              control={
                <Toggle
                  checked={trainingReminders}
                  onChange={handleTrainingRemindersToggle}
                  ariaLabel={t('settings.training_reminders')}
                />
              }
            />
            <SettingRow
              label={t('settings.rest_autostart')}
              desc={t('settings.rest_autostart_desc')}
              control={
                <Toggle
                  checked={restAutoStart}
                  onChange={setRestAutoStart}
                  ariaLabel={t('settings.rest_autostart')}
                />
              }
              divider={restAutoStart}
            />

            {restAutoStart && (
              <div className="px-4 py-3.5">
                <div className="text-base text-fg">{t('settings.rest_duration')}</div>
                <div className="text-xs mb-2.5 text-fg-subtle">
                  {t('settings.rest_duration_desc')}
                </div>
                <div className="flex gap-1.5">
                  {[60, 90, 120, 180].map((seconds) => (
                    <button
                      type="button"
                      key={seconds}
                      onClick={() => setRestDuration(seconds)}
                      aria-pressed={restDuration === seconds}
                      className={`flex-1 min-h-11 rounded-sm text-sm font-display font-bold tabular border transition-colors ${
                        restDuration === seconds
                          ? 'bg-accent text-accent-fg border-accent'
                          : 'bg-surface-2 text-fg-muted border-line'
                      }`}
                    >
                      {seconds < 120 ? `${seconds}s` : `${seconds / 60}min`}
                    </button>
                  ))}
                </div>

                <div className="dotted-separator mt-4" />
                <div className="pt-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base text-fg">{t('settings.rest_by_exercise')}</div>
                    <div className="text-xs mt-0.5 text-fg-subtle">
                      {t('settings.rest_by_exercise_desc')}
                    </div>
                  </div>
                  <Toggle
                    checked={restByExercise}
                    onChange={setRestByExercise}
                    ariaLabel={t('settings.rest_by_exercise')}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Notificaciones */}
        <section>
          <SectionHeader title={t('settings.notifications')} />
          <div className="rounded-card bg-surface border border-line overflow-hidden">
            <SettingRow
              label={t('settings.notifications')}
              desc={t('settings.notifications_desc')}
              control={
                <Toggle
                  checked={notificationsEnabled}
                  onChange={() => handlePushToggle()}
                  ariaLabel={t('settings.notifications')}
                />
              }
              divider={isNative()}
            />
            {/* Solo si el sistema nos está degradando la alarma a inexacta: si
                está concedido no hay nada que pedir y la fila sobra. */}
            {isNative() && exactAlarmsGranted === false && (
              <SettingRow
                label={t('settings.exact_alarms')}
                desc={t('settings.exact_alarms_desc')}
                control={
                  <button
                    type="button"
                    onClick={() => void handleExactAlarmsRequest()}
                    className="min-h-11 px-4 rounded-pill bg-accent text-accent-fg text-sm font-semibold"
                  >
                    {t('settings.exact_alarms_action')}
                  </button>
                }
              />
            )}
            {isNative() && (
              <SettingRow
                label={t('settings.biometric')}
                desc={t('settings.biometric_desc')}
                control={
                  <Toggle
                    checked={biometricEnabled}
                    onChange={() => handleBiometricToggle()}
                    ariaLabel={t('settings.biometric')}
                  />
                }
                divider={false}
              />
            )}
          </div>
        </section>

        {/* Datos */}
        <section>
          <SectionHeader title={t('settings.data')} />
          <div className="rounded-card bg-surface border border-line overflow-hidden">
            <button
              type="button"
              onClick={() => navigate('/wearables')}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-hover"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
                  <IconWatch className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base text-fg">{t('settings.wearables')}</span>
                  <span className="block text-xs mt-0.5 text-fg-subtle">
                    {t('settings.wearables_desc')}
                  </span>
                </span>
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0 text-fg-subtle" />
            </button>
          </div>
        </section>

        {/* Cuenta */}
        <section>
          <SectionHeader title={t('settings.account')} />
          <div className="rounded-card bg-surface border border-line overflow-hidden">
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left text-error active:bg-hover"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-base font-semibold">{t('settings.logout')}</span>
            </button>
          </div>
        </section>

        <div className="pt-2 text-center">
          <div className="label-caps text-fg-subtle">
            {t('settings.version', { version: __APP_VERSION__ })} — {t('settings.tagline')}
          </div>
        </div>
      </div>
    </Layout>
  );
}
