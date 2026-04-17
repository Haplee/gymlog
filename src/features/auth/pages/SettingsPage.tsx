import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { Layout } from '@app/components/Layout';
import { Button, GymLogLogo } from '@/shared/components/ui';
import { supabase } from '@shared/lib/supabase';
import { requestPermission, isNative } from '@shared/lib/notifications';
import { toast } from 'sonner';
import BiometricPlugin from '@shared/lib/biometric';

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
          console.error('Error checking biometric:', e);
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
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as Window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      playSound(1200, 0.25, 0, ctx);
      playSound(1500, 0.25, 0.15, ctx);
      playSound(1800, 0.35, 0.3, ctx);
    } catch (e) {
      console.error('[Sound] Error:', e);
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
        console.error('Error biometric:', e);
      }
    } else {
      setBiometricEnabled(false);
      await BiometricPlugin.setBiometricEnabled({ enabled: false });
      toast.success('Acceso biométrico desactivado');
    }
  };

  const bgCard = 'var(--bg-surface)';
  const border = 'var(--border-default)';
  const accent = 'var(--color-primary)';

  return (
    <Layout>
      <div
        className="fade-in-up text-[1.2rem] font-extrabold mb-4 scale-in"
        style={{ color: accent }}
      >
        {t('settings.title')}
      </div>

      <div className="space-y-3 pb-20">
        {/* Idioma */}
        <div
          className="rounded-2xl p-4 scale-in"
          style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}
        >
          <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('settings.language')}
          </div>
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
        <div
          className="rounded-2xl p-4 scale-in"
          style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[0.95rem]" style={{ color: 'var(--text-primary)' }}>
                {t('settings.sound')}
              </div>
              <div className="text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>
                {t('settings.sound_desc')}
              </div>
            </div>
            <button
              onClick={() => {
                setSound(!sound);
                if (!sound) playFeedbackSound();
              }}
              className={`w-12 h-6 rounded-full transition-all relative ${sound ? 'bg-[--color-primary]' : 'bg-[--bg-base]'}`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${sound ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>
        </div>

        {/* Notificaciones */}
        <div
          className="rounded-2xl p-4 scale-in"
          style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[0.95rem]" style={{ color: 'var(--text-primary)' }}>
                {t('settings.notifications')}
              </div>
              <div className="text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>
                {t('settings.notifications_desc')}
              </div>
            </div>
            <button
              onClick={handlePushToggle}
              className={`w-12 h-6 rounded-full transition-all relative ${notifEnabled ? 'bg-[--color-primary]' : 'bg-[--bg-base]'}`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notifEnabled ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>
        </div>

        {/* Biometría (Solo Nativo) */}
        {isNative() && (
          <div
            className="rounded-2xl p-4 scale-in border"
            style={{ backgroundColor: bgCard, borderColor: border }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[0.95rem]" style={{ color: 'var(--text-primary)' }}>
                  Acceso Biométrico
                </div>
                <div className="text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>
                  Usa tu huella o cara para entrar
                </div>
              </div>
              <button
                onClick={handleBiometricToggle}
                className={`w-12 h-6 rounded-full transition-all relative ${biometricEnabled ? 'bg-[--color-primary]' : 'bg-[--bg-base]'}`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${biometricEnabled ? 'left-7' : 'left-1'}`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Recordatorios de entrenamiento */}
        <div
          className="rounded-2xl p-4 scale-in border"
          style={{ backgroundColor: bgCard, borderColor: border }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[0.95rem]" style={{ color: 'var(--text-primary)' }}>
                Recordatorios de entreno
              </div>
              <div className="text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>
                Avisar si llevo 2 días sin entrenar
              </div>
            </div>
            <button
              onClick={() => setTrainingReminders(!trainingReminders)}
              className={`w-12 h-6 rounded-full transition-all relative ${trainingReminders ? 'bg-[--color-primary]' : 'bg-[--bg-base]'}`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${trainingReminders ? 'left-7' : 'left-1'}`}
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

        <div
          className="rounded-2xl p-6 scale-in flex flex-col items-center text-center"
          style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}
        >
          <GymLogLogo size="lg" variant="stacked" className="mb-4" />
          <div className="text-[0.8rem] font-bold text-[var(--interactive-primary)] mb-4 uppercase tracking-[0.2em] bg-[var(--interactive-primary)]/10 px-3 py-1 rounded-full">
            Version 2.5
          </div>
          <div className="text-[0.85rem] leading-relaxed text-[var(--text-tertiary)] max-w-[240px]">
            Tu compañero definitivo para el seguimiento de entrenamientos de fuerza.
          </div>
        </div>
      </div>
    </Layout>
  );
}
