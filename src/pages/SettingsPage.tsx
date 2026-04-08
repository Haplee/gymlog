import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Layout } from '../components/Layout';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { vibration, sound, restTimerDefault, setVibration, setSound, setRestTimerDefault } = useSettingsStore();
  const [animVibration, setAnimVibration] = useState(false);
  const [animSound, setAnimSound] = useState(false);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const bgCard = '#141418';
  const border = 'rgba(255,255,255,0.06)';
  const textPrimary = '#fafafa';
  const textMuted = '#606068';
  const accent = '#c8ff00';
  const toggleOn = '#c8ff00';
  const toggleOff = '#3a3a42';
  const danger = '#ff5252';

  const triggerVibration = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
  };

  const playClickSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
      
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1100;
        osc2.type = 'square';
        gain2.gain.setValueAtTime(0.5, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.2);
      }, 100);
    } catch (e) {}
  };

  const handleToggle = (type: 'vibration' | 'sound') => {
    if (type === 'vibration') {
      const newValue = !vibration;
      setAnimVibration(true);
      setVibration(newValue);
      triggerVibration();
      setTimeout(() => setAnimVibration(false), 300);
    } else {
      const newValue = !sound;
      setAnimSound(true);
      setSound(newValue);
      if (newValue) playClickSound();
      setTimeout(() => setAnimSound(false), 300);
    }
  };

  return (
    <Layout>
      <div className="fade-in-up text-[1.2rem] font-extrabold mb-4" style={{ color: accent }}>Configuración</div>

      <div className="fade-in-up rounded-2xl p-4 mb-3" style={{ backgroundColor: bgCard, border: `1px solid ${border}`, animationDelay: '0.1s', opacity: 0 }}>
        <div className="text-[1rem] font-semibold mb-4" style={{ color: textPrimary }}>Sonido y vibración</div>
        
        <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: border }}>
          <div>
            <div className="text-[0.95rem]" style={{ color: textPrimary }}>Vibración</div>
            <div className="text-[0.75rem]" style={{ color: textMuted }}>Vibrar al completar serie</div>
          </div>
          <button
            onClick={() => handleToggle('vibration')}
            className={`w-14 h-8 rounded-full transition-all duration-300 cursor-pointer relative ${animVibration ? 'btn-press' : ''}`}
            style={{
              backgroundColor: vibration ? toggleOn : toggleOff,
              boxShadow: vibration ? `0 0 16px ${toggleOn}50` : 'none',
              transform: vibration ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <div
              className="absolute top-1 w-6 h-6 rounded-full transition-all duration-300 shadow-lg"
              style={{
                left: vibration ? '28px' : '4px',
                backgroundColor: vibration ? '#000' : '#fff',
              }}
            />
          </button>
        </div>

        <div className="flex items-center justify-between py-3">
          <div>
            <div className="text-[0.95rem]" style={{ color: textPrimary }}>Sonido</div>
            <div className="text-[0.75rem]" style={{ color: textMuted }}>Reproducir sonido al completar serie</div>
          </div>
          <button
            onClick={() => handleToggle('sound')}
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

      <div className="fade-in-up rounded-2xl p-4 mb-3" style={{ backgroundColor: bgCard, border: `1px solid ${border}`, animationDelay: '0.2s', opacity: 0 }}>
        <div className="text-[1rem] font-semibold mb-3" style={{ color: textPrimary }}>Temporizador</div>
        <div className="text-[0.9rem] mb-3" style={{ color: textMuted }}>Tiempo por defecto: {restTimerDefault}s</div>
        <input
          type="range"
          min="30"
          max="300"
          step="15"
          value={restTimerDefault}
          onChange={(e) => setRestTimerDefault(parseInt(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{ background: toggleOff }}
        />
        <div className="flex justify-between text-[0.7rem] mt-1" style={{ color: textMuted }}>
          <span>30s</span><span>1:30</span><span>3:00</span><span>5:00</span>
        </div>
      </div>

      <button
        onClick={() => signOut()}
        className="fade-in-up w-full rounded-2xl p-4 mb-3 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ 
          backgroundColor: bgCard, 
          border: `1px solid ${border}`,
          animationDelay: '0.3s', 
          opacity: 0 
        }}
      >
        <div className="text-[1rem] font-semibold" style={{ color: danger }}>Cerrar sesión</div>
        <div className="text-[0.75rem]" style={{ color: textMuted }}>Salir de tu cuenta</div>
      </button>

      <div className="fade-in-up rounded-2xl p-4" style={{ backgroundColor: bgCard, border: `1px solid ${border}`, animationDelay: '0.4s', opacity: 0 }}>
        <div className="text-[1rem] font-semibold mb-2" style={{ color: textPrimary }}>Acerca de</div>
        <div className="text-[0.85rem]" style={{ color: textMuted }}>GymLog v1.6</div>
        <div className="text-[0.75rem] mt-1" style={{ color: textMuted }}>Tu compañero de entrenamiento</div>
      </div>
    </Layout>
  );
}
