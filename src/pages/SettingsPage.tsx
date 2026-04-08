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

const triggerVibration = (pattern: number[]): boolean => {
  if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      return navigator.vibrate(pattern);
    } catch (e) {
      console.warn('[Vibration] Not supported:', e);
      return false;
    }
  }
  return false;
};

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { vibration, sound, restTimerDefault, setVibration, setSound, setRestTimerDefault } = useSettingsStore();
  const [animVibration, setAnimVibration] = useState(false);
  const [animSound, setAnimSound] = useState(false);
  const [vibrationSupported, setVibrationSupported] = useState(true);
  const [soundSupported, setSoundSupported] = useState(true);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    setVibrationSupported('vibrate' in navigator && typeof navigator.vibrate === 'function');
    setSoundSupported(typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined');
  }, []);

  const playFeedbackSound = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('[Sound] Not supported');
        setSoundSupported(false);
        return;
      }
      const ctx = new AudioContextClass();
      playSound(1200, 0.25, 0, ctx);
      playSound(1500, 0.25, 0.15, ctx);
      playSound(1800, 0.35, 0.30, ctx);
    } catch (e) {
      console.error('[Sound] Error:', e);
      setSoundSupported(false);
    }
  }, []);

  const handleToggle = (type: 'vibration' | 'sound') => {
    if (type === 'vibration') {
      if (!vibrationSupported) return;
      const newValue = !vibration;
      setAnimVibration(true);
      setVibration(newValue);
      triggerVibration([200, 100, 200, 100, 300]);
      setTimeout(() => setAnimVibration(false), 300);
    } else {
      if (!soundSupported) return;
      const newValue = !sound;
      setAnimSound(true);
      setSound(newValue);
      if (newValue) playFeedbackSound();
      setTimeout(() => setAnimSound(false), 300);
    }
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
