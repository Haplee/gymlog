import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Layout } from '../components/Layout';

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
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { sound, setSound } = useSettingsStore();
  const [animSound, setAnimSound] = useState(false);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const playFeedbackSound = useCallback(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      playSound(1200, 0.25, 0, ctx);
      playSound(1500, 0.25, 0.15, ctx);
      playSound(1800, 0.35, 0.30, ctx);
    } catch (e) {
      console.error('[Sound] Error:', e);
    }
  }, []);

  const handleToggle = () => {
    const newValue = !sound;
    setAnimSound(true);
    setSound(newValue);
    if (newValue) playFeedbackSound();
    setTimeout(() => setAnimSound(false), 300);
  };

  const bgCard = '#141418';
  const border = 'rgba(255,255,255,0.06)';
  const textPrimary = '#fafafa';
  const textMuted = '#606068';
  const accent = '#c8ff00';
  const toggleOn = '#c8ff00';
  const toggleOff = '#3a3a42';
  const danger = '#ff5252';

  return (
    <Layout>
      <div className="fade-in-up text-[1.2rem] font-extrabold mb-4 scale-in" style={{ color: accent }}>Ajustes</div>

      <div className="rounded-2xl p-4 mb-3 scale-in" style={{ backgroundColor: bgCard, border: `1px solid ${border}`, animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[0.95rem]" style={{ color: textPrimary }}>Sonido</div>
            <div className="text-[0.75rem]" style={{ color: textMuted }}>Sonido al completar</div>
          </div>
          <button
            onClick={handleToggle}
            className={`w-14 h-8 rounded-full transition-all duration-300 cursor-pointer relative ${animSound ? 'btn-press' : ''}`}
            style={{
              backgroundColor: sound ? toggleOn : toggleOff,
              boxShadow: sound ? `0 0 16px ${toggleOn}50` : 'none',
              transform: sound ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <div
              className="absolute top-1 w-6 h-6 rounded-full transition-all duration-300 shadow-lg"
              style={{
                left: sound ? '28px' : '4px',
                backgroundColor: sound ? '#000' : '#fff',
              }}
            />
          </button>
        </div>
      </div>

      <button
        onClick={() => signOut()}
        className="w-full rounded-2xl p-4 mb-3 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] scale-in"
        style={{ 
          backgroundColor: bgCard, 
          border: `1px solid ${border}`,
          animationDelay: '0.2s'
        }}
      >
        <div className="text-[1rem] font-semibold" style={{ color: danger }}>Cerrar sesión</div>
        <div className="text-[0.75rem]" style={{ color: textMuted }}>Salir de tu cuenta</div>
      </button>

      <div className="rounded-2xl p-4 scale-in" style={{ backgroundColor: bgCard, border: `1px solid ${border}`, animationDelay: '0.3s' }}>
        <div className="text-[1rem] font-semibold mb-2" style={{ color: textPrimary }}>Acerca de</div>
        <div className="text-[0.85rem]" style={{ color: textMuted }}>GymLog v1.8</div>
        <div className="text-[0.75rem] mt-1" style={{ color: textMuted }}>Tu compañero de entrenamiento</div>
      </div>
    </Layout>
  );
}
