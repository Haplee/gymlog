import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Layout } from '../components/Layout';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { theme, vibration, sound, restTimerDefault, setTheme, setVibration, setSound, setRestTimerDefault } = useSettingsStore();

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const isLight = theme === 'light';
  const colors = isLight ? {
    bgCard: '#ffffff',
    border: '#e0e0e0',
    textPrimary: '#1a1a1a',
    textSecondary: '#666666',
    textMuted: '#999999',
    accent: '#10b981',
    toggleOn: '#10b981',
    toggleOff: '#cccccc',
  } : {
    bgCard: '#141418',
    border: 'rgba(255,255,255,0.06)',
    textPrimary: '#fafafa',
    textSecondary: '#a1a1aa',
    textMuted: '#606068',
    accent: '#c8ff00',
    toggleOn: '#c8ff00',
    toggleOff: '#3a3a42',
  };

  return (
    <Layout>
      <div className="text-[1.2rem] font-extrabold mb-4" style={{ color: colors.accent }}>Configuración</div>

      <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.border}` }}>
        <div className="text-[1rem] font-semibold mb-4" style={{ color: colors.textPrimary }}>Apariencia</div>
        
        <button onClick={() => setTheme(isLight ? 'dark' : 'light')} className="w-full flex items-center justify-between py-3">
          <div>
            <div className="text-[0.95rem]" style={{ color: colors.textPrimary }}>Tema oscuro</div>
            <div className="text-[0.75rem]" style={{ color: colors.textMuted }}>{isLight ? 'Modo claro activo' : 'Modo oscuro activo'}</div>
          </div>
          <div className={`w-12 h-7 rounded-full transition-colors relative`} style={{ backgroundColor: isLight ? colors.toggleOff : colors.toggleOn }}>
            <div className="absolute top-1 w-5 h-5 rounded-full transition-transform" style={{ 
              left: isLight ? '4px' : '26px',
              backgroundColor: isLight ? '#fff' : '#000'
            }} />
          </div>
        </button>
      </div>

      <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.border}` }}>
        <div className="text-[1rem] font-semibold mb-4" style={{ color: colors.textPrimary }}>Sonido y vibración</div>
        
        <button onClick={() => setVibration(!vibration)} className="w-full flex items-center justify-between py-3 border-b" style={{ borderColor: colors.border }}>
          <div>
            <div className="text-[0.95rem]" style={{ color: colors.textPrimary }}>Vibración</div>
            <div className="text-[0.75rem]" style={{ color: colors.textMuted }}>Vibrar al completar serie</div>
          </div>
          <div className={`w-12 h-7 rounded-full transition-colors relative`} style={{ backgroundColor: vibration ? colors.toggleOn : colors.toggleOff }}>
            <div className="absolute top-1 w-5 h-5 rounded-full transition-transform" style={{ 
              left: vibration ? '26px' : '4px',
              backgroundColor: vibration ? (isLight ? '#fff' : '#000') : '#fff'
            }} />
          </div>
        </button>

        <button onClick={() => setSound(!sound)} className="w-full flex items-center justify-between py-3">
          <div>
            <div className="text-[0.95rem]" style={{ color: colors.textPrimary }}>Sonido</div>
            <div className="text-[0.75rem]" style={{ color: colors.textMuted }}>Reproducir sonido al completar serie</div>
          </div>
          <div className={`w-12 h-7 rounded-full transition-colors relative`} style={{ backgroundColor: sound ? colors.toggleOn : colors.toggleOff }}>
            <div className="absolute top-1 w-5 h-5 rounded-full transition-transform" style={{ 
              left: sound ? '26px' : '4px',
              backgroundColor: sound ? (isLight ? '#fff' : '#000') : '#fff'
            }} />
          </div>
        </button>
      </div>

      <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.border}` }}>
        <div className="text-[1rem] font-semibold mb-3" style={{ color: colors.textPrimary }}>Temporizador</div>
        <div className="text-[0.9rem] mb-3" style={{ color: colors.textSecondary }}>Tiempo por defecto: {restTimerDefault}s</div>
        <input
          type="range"
          min="30"
          max="300"
          step="15"
          value={restTimerDefault}
          onChange={(e) => setRestTimerDefault(parseInt(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{ background: colors.toggleOff }}
        />
        <div className="flex justify-between text-[0.7rem] mt-1" style={{ color: colors.textMuted }}>
          <span>30s</span><span>1:30</span><span>3:00</span><span>5:00</span>
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.border}` }}>
        <div className="text-[1rem] font-semibold mb-2" style={{ color: colors.textPrimary }}>Acerca de</div>
        <div className="text-[0.85rem]" style={{ color: colors.textMuted }}>GymLog v1.2</div>
        <div className="text-[0.75rem] mt-1" style={{ color: colors.textMuted }}>Tu compañero de entrenamiento</div>
      </div>
    </Layout>
  );
}
