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
} from '@shared/lib/notifications';
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
    biometricEnabled,
    setBiometricEnabled,
    trainingReminders,
    setTrainingReminders,
    unitSystem,
    setUnitSystem,
    showWarmupSets,
    setShowWarmupSets,
    restAutoStart,
    setRestAutoStart,
  } = useSettingsStore();
  const [notifEnabled, setNotifEnabled] = useState(false);
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
        setNotifEnabled(!!data.notifications_enabled);
        if (data.notifications_enabled) localStorage.removeItem('notif_disabled');
        else localStorage.setItem('notif_disabled', 'true');
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
  }, [user, navigate, biometricEnabled, setBiometricEnabled]);

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
    const newValue = !notifEnabled;
    if (newValue) {
      localStorage.removeItem('notif_disabled');

      if (!isNative() && 'Notification' in window && Notification.permission === 'denied') {
        toast.error('Permiso de notificaciones denegado en el navegador');
        return;
      }

      const granted = await requestPermission();
      if (granted) {
        setNotifEnabled(true);
        if (user) {
          await supabase.from('profiles').update({ notifications_enabled: true }).eq('id', user.id);
        }
        // Reprogramar recordatorios de rutina con el permiso ya concedido
        await syncRoutineReminders(getReminderDays());
        toast.success('Notificaciones activadas');
      } else {
        localStorage.setItem('notif_disabled', 'true');
        toast.error('No se concedieron permisos de notificación');
      }
    } else {
      setNotifEnabled(false);
      localStorage.setItem('notif_disabled', 'true');
      if (user) {
        await supabase.from('profiles').update({ notifications_enabled: false }).eq('id', user.id);
      }
      // Sin notificaciones: limpiar todo lo programado en el sistema
      await cancelAllScheduled();
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
      <div className="fade-in-up text-xl font-extrabold mb-4 scale-in text-accent">
        {t('settings.title')}
      </div>

      <div className="space-y-3 pb-20">
        {!isNative() && (
          <a
            href="https://github.com/Haplee/pesos/releases/download/2.9.1/GymLog-v2.9.1.apk"
            download
            className="block rounded-2xl p-4 scale-in border text-center bg-surface border-line-accent text-accent shadow-card transition-transform active:scale-[0.99]"
          >
            <div className="text-base font-semibold">Descargar App Android</div>
            <div className="text-xs mt-1 opacity-70">GymLog v2.9.1</div>
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
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${sound ? 'left-7' : 'left-1'}`}
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
              className={`w-12 h-6 rounded-full transition-all relative ${notifEnabled ? 'bg-accent toggle-on' : 'bg-surface-3'}`}
              aria-pressed={notifEnabled}
              aria-label={t('settings.notifications')}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notifEnabled ? 'left-7' : 'left-1'}`}
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
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${biometricEnabled ? 'left-7' : 'left-1'}`}
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
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${trainingReminders ? 'left-7' : 'left-1'}`}
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
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${showWarmupSets ? 'left-7' : 'left-1'}`}
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
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${restAutoStart ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>
        </div>

        <button
          onClick={() => signOut()}
          className="w-full rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] scale-in border-none shadow-md"
          style={{
            backgroundColor: 'var(--color-danger)',
            color: '#ffffff',
          }}
        >
          <div className="text-[1rem] font-semibold">{t('settings.logout')}</div>
        </button>

        <div className="rounded-2xl p-6 scale-in flex flex-col items-center text-center bg-surface border border-line-strong">
          <GymLogLogo size="lg" variant="stacked" className="mb-4" />
          <div className="text-sm font-bold text-accent mb-4 uppercase tracking-[0.2em] bg-accent/10 px-3 py-1 rounded-full">
            Version 2.9
          </div>
          <div className="text-sm leading-relaxed text-fg-subtle max-w-[240px]">
            Tu compañero definitivo para el seguimiento de entrenamientos de fuerza.
          </div>
        </div>
      </div>
    </Layout>
  );
}
