import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { Layout } from '@app/components/Layout';
import { Button, GymLogLogo } from '@/shared/components/ui';
import { supabase } from '@shared/lib/supabase';
import {
  requestPermission,
  isNative,
  cancelAllScheduled,
  syncRoutineReminders,
  scheduleStreakReminder,
  scheduleWeeklySummaryReminder,
} from '@shared/lib/notifications';
import { registerPushNotifications, unregisterPushToken } from '@shared/lib/push';
import { getReminderDays } from '@features/routine/hooks/useWorkoutReminder';
import { toast } from 'sonner';
import BiometricPlugin from '@shared/lib/biometric';
import { devError } from '@shared/lib/devtools';

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
  } = useSettingsStore();
  const [biometricSupport, setBiometricSupport] = useState<{ available: boolean; message: string }>(
    { available: false, message: '' },
  );

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchConfig = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('notifications_enabled')
        .eq('id', user.id)
        .single();
      if (data) {
        // setNotificationsEnabled espeja el flag en localStorage internamente
        setNotificationsEnabled(!!data.notifications_enabled);
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
        toast.error('Permiso de notificaciones denegado en el navegador');
        return;
      }

      const granted = await requestPermission();
      if (granted) {
        if (user) {
          await supabase.from('profiles').update({ notifications_enabled: true }).eq('id', user.id);
        }
        // Reprogramar todas las alarmas nativas con el permiso ya concedido
        await syncRoutineReminders(getReminderDays());
        await scheduleStreakReminder();
        await scheduleWeeklySummaryReminder();
        // Registrar token push remoto
        if (user) void registerPushNotifications(user.id);
        toast.success('Notificaciones activadas');
      } else {
        setNotificationsEnabled(false);
        toast.error('No se concedieron permisos de notificación');
      }
    } else {
      setNotificationsEnabled(false);
      if (user) {
        await supabase.from('profiles').update({ notifications_enabled: false }).eq('id', user.id);
      }
      // Sin notificaciones: limpiar todo lo programado en el sistema
      await cancelAllScheduled();
      // Y eliminar el token push remoto del dispositivo
      await unregisterPushToken();
    }
  };

  const handleBiometricToggle = async () => {
    if (!isNative()) return;

    if (!biometricSupport.available) {
      toast.error(`Biometría no disponible: ${biometricSupport.message}`);
      return;
    }

    if (!biometricEnabled) {
      const loadId = toast.loading('Verificando identidad...');
      try {
        const result = await BiometricPlugin.authenticate();
        if (result.success) {
          setBiometricEnabled(true);
          await BiometricPlugin.setBiometricEnabled({ enabled: true });
          toast.success('Acceso biométrico activado', { id: loadId });
        } else {
          toast.error(result.message || 'Autenticación fallida', { id: loadId });
        }
      } catch (e) {
        toast.error('Error al conectar con el sensor', { id: loadId });
        devError('Error biometric:', e);
      }
    } else {
      setBiometricEnabled(false);
      await BiometricPlugin.setBiometricEnabled({ enabled: false });
      toast.success('Acceso biométrico desactivado');
    }
  };

  return (
    <Layout>
      <div className="space-y-3 pb-20">
        {!isNative() && (
          <a
            href="https://github.com/Haplee/pesos/releases/download/v3.1.0-android/GymLog-v3.1.0.apk"
            download
            className="block rounded-2xl p-4 scale-in border text-center bg-surface border-line-accent text-accent shadow-card transition-transform active:scale-[0.99]"
          >
            <div className="text-base font-semibold">Descargar App Android</div>
            <div className="text-xs mt-1 opacity-70">GymLog v3.2.0</div>
          </a>
        )}

        {/* Idioma */}
        <div className="rounded-2xl p-4 scale-in bg-surface border border-line-strong shadow-card">
          <div className="text-sm font-medium mb-3 text-fg">{t('settings.language')}</div>
          <div className="flex gap-2">
            {['es', 'en'].map((lang) => (
              <Button
                key={lang}
                variant={language === lang ? 'primary' : 'secondary'}
                onClick={() => setLanguage(lang)}
                className="flex-1"
              >
                {lang === 'es' ? 'Español' : 'English'}
              </Button>
            ))}
          </div>
        </div>

        {/* Tema */}
        <div className="rounded-2xl p-4 scale-in bg-surface border border-line-strong shadow-card">
          <div className="text-sm font-medium mb-3 text-fg">{t('settings.theme')}</div>
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map((mode) => (
              <Button
                key={mode}
                variant={theme === mode ? 'primary' : 'secondary'}
                onClick={() => setTheme(mode)}
                className="flex-1"
                aria-pressed={theme === mode}
              >
                {mode === 'dark' ? t('settings.theme_dark') : t('settings.theme_light')}
              </Button>
            ))}
          </div>
        </div>

        {/* Sonido */}
        <div className="rounded-2xl p-4 scale-in bg-surface border border-line-strong shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base text-fg">{t('settings.sound')}</div>
              <div className="text-xs text-fg-subtle">{t('settings.sound_desc')}</div>
            </div>
            <button
              onClick={() => {
                setSound(!sound);
                if (!sound) playFeedbackSound();
              }}
              className={`w-12 h-6 rounded-full transition-all relative ${sound ? 'bg-accent toggle-on' : 'bg-surface-3'}`}
              aria-pressed={sound}
              aria-label={t('settings.sound')}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-fg shadow-sm transition-all ${sound ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>
        </div>

        {/* Notificaciones */}
        <div className="rounded-2xl p-4 scale-in bg-surface border border-line-strong shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base text-fg">{t('settings.notifications')}</div>
              <div className="text-xs text-fg-subtle">{t('settings.notifications_desc')}</div>
            </div>
            <button
              onClick={handlePushToggle}
              className={`w-12 h-6 rounded-full transition-all relative ${notificationsEnabled ? 'bg-accent toggle-on' : 'bg-surface-3'}`}
              aria-pressed={notificationsEnabled}
              aria-label={t('settings.notifications')}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-fg shadow-sm transition-all ${notificationsEnabled ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>
        </div>

        {/* Biometría (Solo Nativo) */}
        {isNative() && (
          <div className="rounded-2xl p-4 scale-in bg-surface border border-line-strong shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base text-fg">Acceso Biométrico</div>
                <div className="text-xs text-fg-subtle">Usa tu huella o cara para entrar</div>
              </div>
              <button
                onClick={handleBiometricToggle}
                className={`w-12 h-6 rounded-full transition-all relative ${biometricEnabled ? 'bg-accent toggle-on' : 'bg-surface-3'}`}
                aria-pressed={biometricEnabled}
                aria-label={'Acceso Biométrico'}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-fg shadow-sm transition-all ${biometricEnabled ? 'left-7' : 'left-1'}`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Recordatorios de entrenamiento */}
        <div className="rounded-2xl p-4 scale-in bg-surface border border-line-strong shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base text-fg">Recordatorios de entreno</div>
              <div className="text-xs text-fg-subtle">Avisar si llevo 2 días sin entrenar</div>
            </div>
            <button
              onClick={() => setTrainingReminders(!trainingReminders)}
              className={`w-12 h-6 rounded-full transition-all relative ${trainingReminders ? 'bg-accent toggle-on' : 'bg-surface-3'}`}
              aria-pressed={trainingReminders}
              aria-label={'Recordatorios de entreno'}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-fg shadow-sm transition-all ${trainingReminders ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>
        </div>

        {/* Unidad de peso */}
        <div className="rounded-2xl p-4 scale-in bg-surface border border-line-strong shadow-card">
          <div className="text-sm font-medium mb-3 text-fg">Unidad de peso</div>
          <div className="flex gap-2">
            {(['kg', 'lb'] as const).map((unit) => (
              <Button
                key={unit}
                variant={unitSystem === unit ? 'primary' : 'secondary'}
                onClick={() => setUnitSystem(unit)}
                className="flex-1"
              >
                {unit}
              </Button>
            ))}
          </div>
        </div>

        {/* Mostrar series de calentamiento */}
        <div className="rounded-2xl p-4 scale-in bg-surface border border-line-strong shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base text-fg">Series de calentamiento</div>
              <div className="text-xs text-fg-subtle">Marcar series de warmup</div>
            </div>
            <button
              onClick={() => setShowWarmupSets(!showWarmupSets)}
              className={`w-12 h-6 rounded-full transition-all relative ${showWarmupSets ? 'bg-accent toggle-on' : 'bg-surface-3'}`}
              aria-pressed={showWarmupSets}
              aria-label={'Series de calentamiento'}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-fg shadow-sm transition-all ${showWarmupSets ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>
        </div>

        {/* Auto-iniciar temporizador descanso */}
        <div className="rounded-2xl p-4 scale-in bg-surface border border-line-strong shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base text-fg">Auto-iniciar descanso</div>
              <div className="text-xs text-fg-subtle">Inicia el temporizador al añadir serie</div>
            </div>
            <button
              onClick={() => setRestAutoStart(!restAutoStart)}
              className={`w-12 h-6 rounded-full transition-all relative ${restAutoStart ? 'bg-accent toggle-on' : 'bg-surface-3'}`}
              aria-pressed={restAutoStart}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-fg shadow-sm transition-all ${restAutoStart ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>

          {restAutoStart && (
            <div className="mt-4 pt-4 border-t border-line">
              <div className="text-base text-fg">{t('settings.rest_duration')}</div>
              <div className="text-xs mb-2 text-fg-subtle">{t('settings.rest_duration_desc')}</div>
              <div className="flex gap-1.5">
                {[60, 90, 120, 180].map((seconds) => (
                  <button
                    key={seconds}
                    onClick={() => setRestDuration(seconds)}
                    aria-pressed={restDuration === seconds}
                    className="flex-1 min-h-11 rounded-lg text-sm font-medium border"
                    style={{
                      backgroundColor:
                        restDuration === seconds
                          ? 'var(--interactive-primary)'
                          : 'var(--bg-surface-2)',
                      color:
                        restDuration === seconds
                          ? 'var(--interactive-primary-fg)'
                          : 'var(--text-secondary)',
                      borderColor:
                        restDuration === seconds
                          ? 'var(--interactive-primary)'
                          : 'var(--border-subtle)',
                    }}
                  >
                    {seconds < 120 ? `${seconds}s` : `${seconds / 60}min`}
                  </button>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
                <div>
                  <div className="text-base text-fg">{t('settings.rest_by_exercise')}</div>
                  <div className="text-xs text-fg-subtle">
                    {t('settings.rest_by_exercise_desc')}
                  </div>
                </div>
                <button
                  onClick={() => setRestByExercise(!restByExercise)}
                  className={`w-12 h-6 rounded-full transition-all relative ${restByExercise ? 'bg-accent toggle-on' : 'bg-surface-3'}`}
                  aria-pressed={restByExercise}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-fg shadow-sm transition-all ${restByExercise ? 'left-7' : 'left-1'}`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => signOut()}
          className="w-full rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] scale-in border-none shadow-md"
          style={{
            backgroundColor: 'var(--color-danger)',
            color: '#ffffff',
          }}
        >
          <div className="text-base font-semibold">{t('settings.logout')}</div>
        </button>

        <div className="rounded-2xl p-6 scale-in flex flex-col items-center text-center bg-surface border border-line-strong">
          <GymLogLogo size="lg" variant="stacked" className="mb-4" />
          <div className="text-sm font-bold text-accent mb-4 uppercase tracking-[0.2em] bg-accent/10 px-3 py-1 rounded-full">
            Version 3.2
          </div>
          <div className="text-sm leading-relaxed text-fg-subtle max-w-[240px]">
            Tu compañero definitivo para el seguimiento de entrenamientos de fuerza.
          </div>
        </div>
      </div>
    </Layout>
  );
}
