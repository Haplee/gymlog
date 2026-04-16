import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { Layout } from '@app/components/Layout';
import { Button } from '@shared/components/ui';
import { supabase } from '@shared/lib/supabase';
import { requestPermission } from '@shared/lib/notifications';

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
  const { sound, setSound, language, setLanguage } = useSettingsStore();
  const [notifEnabled, setNotifEnabled] = useState(false);

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
    fetchConfig();
  }, [user, navigate]);

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

      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          setNotifEnabled(true);
          if (user) {
            await supabase
              .from('profiles')
              .update({ notifications_enabled: true })
              .eq('id', user.id);
          }
        } else if (Notification.permission === 'denied') {
          localStorage.setItem('notif_disabled', 'true');
        } else {
          const permission = await requestPermission();
          if (permission === 'granted') {
            setNotifEnabled(true);
            if (user) {
              await supabase
                .from('profiles')
                .update({ notifications_enabled: true })
                .eq('id', user.id);
            }
          } else {
            localStorage.setItem('notif_disabled', 'true');
          }
        }
      } else {
        setNotifEnabled(true);
        if (user) {
          await supabase.from('profiles').update({ notifications_enabled: true }).eq('id', user.id);
        }
      }
    } else {
      setNotifEnabled(false);
      localStorage.setItem('notif_disabled', 'true');
      if (user) {
        await supabase.from('profiles').update({ notifications_enabled: false }).eq('id', user.id);
      }
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

        <button
          onClick={() => signOut()}
          className="w-full rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] scale-in border"
          style={{
            backgroundColor: bgCard,
            borderColor: 'var(--color-danger-border)',
            color: 'var(--color-danger)',
          }}
        >
          <div className="text-[1rem] font-semibold">{t('settings.logout')}</div>
        </button>

        <div
          className="rounded-2xl p-4 scale-in"
          style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}
        >
          <div className="text-[1rem] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('settings.about')}
          </div>
          <div className="text-[0.85rem]" style={{ color: 'var(--text-muted)' }}>
            {t('settings.version')}
          </div>
        </div>
      </div>
    </Layout>
  );
}
