import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Layout } from '../components/Layout';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { vibration, sound, restTimerDefault, setVibration, setSound, setRestTimerDefault } = useSettingsStore();

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

  const handleToggle = (type: 'vibration' | 'sound') => {
    if (type === 'vibration') {
      const newValue = !vibration;
      setVibration(newValue);
      if (newValue && 'vibrate' in navigator) navigator.vibrate(50);
    } else {
      const newValue = !sound;
      setSound(newValue);
      if (newValue) playClickSound();
    }
  };

  const playClickSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 600;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="w-11 h-6 rounded-full transition-all duration-200 relative cursor-pointer"
      style={{
        backgroundColor: on ? toggleOn : toggleOff,
        transform: 'scale(1)',
      }}
    >
      <div
        className="absolute top-1 w-5 h-5 rounded-full transition-all duration-200 shadow-sm"
        style={{
          left: on ? '22px' : '4px',
          backgroundColor: on ? '#000' : '#fff',
          transform: on ? 'scale(1.1)' : 'scale(1)',
        }}
      />
    </button>
  );

  return (
    <Layout>
      <div className="text-[1.2rem] font-extrabold mb-4" style={{ color: accent }}>Configuración</div>

      <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}>
        <div className="text-[1rem] font-semibold mb-4" style={{ color: textPrimary }}>Sonido y vibración</div>
        
        <button
          onClick={() => handleToggle('vibration')}
          className="w-full flex items-center justify-between py-3 border-b active:scale-[0.98] transition-transform cursor-pointer"
          style={{ borderColor: border }}
        >
          <div>
            <div className="text-[0.95rem]" style={{ color: textPrimary }}>Vibración</div>
            <div className="text-[0.75rem]" style={{ color: textMuted }}>Vibrar al completar serie</div>
          </div>
          <Toggle on={vibration} onClick={() => handleToggle('vibration')} />
        </button>

        <button
          onClick={() => handleToggle('sound')}
          className="w-full flex items-center justify-between py-3 active:scale-[0.98] transition-transform cursor-pointer"
        >
          <div>
            <div className="text-[0.95rem]" style={{ color: textPrimary }}>Sonido</div>
            <div className="text-[0.75rem]" style={{ color: textMuted }}>Reproducir sonido al completar serie</div>
          </div>
          <Toggle on={sound} onClick={() => handleToggle('sound')} />
        </button>
      </div>

      <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}>
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

      <div className="rounded-2xl p-4" style={{ backgroundColor: bgCard, border: `1px solid ${border}` }}>
        <div className="text-[1rem] font-semibold mb-2" style={{ color: textPrimary }}>Acerca de</div>
        <div className="text-[0.85rem]" style={{ color: textMuted }}>GymLog v1.5</div>
        <div className="text-[0.75rem] mt-1" style={{ color: textMuted }}>Tu compañero de entrenamiento</div>
      </div>
    </Layout>
  );
}
