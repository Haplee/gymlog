import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Layout } from '../components/Layout';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { theme, vibration, sound, restTimerDefault, setTheme, setVibration, setSound, setRestTimerDefault } = useSettingsStore();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const bgCard = theme === 'light' ? '#f4f3ec' : '#141418';
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const textPrimary = theme === 'light' ? '#08060d' : '#fafafa';
  const textSecondary = theme === 'light' ? '#6b6375' : '#a1a1aa';
  const textMuted = theme === 'light' ? '#a0a0a8' : '#606068';
  const accent = '#c8ff00';

  return (
    <Layout>
      <div className="text-[1.1rem] sm:text-[1.2rem] font-extrabold mb-4 px-1" style={{ color: accent }}>Configuración</div>

      <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: bgCard, border: `1px solid ${borderColor}` }}>
        <div className="text-[0.95rem] sm:text-[1rem] font-semibold mb-4" style={{ color: textPrimary }}>Apariencia</div>
        
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center justify-between py-2"
        >
          <div className="text-left">
            <div className="text-[0.9rem] sm:text-[0.95rem]" style={{ color: textPrimary }}>Tema oscuro</div>
            <div className="text-[0.7rem]" style={{ color: textMuted }}>Usar modo oscuro</div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${theme === 'dark' ? 'bg-[#c8ff00]' : 'bg-[#3a3a42]'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-transform ${theme === 'dark' ? 'left-[22px]' : 'left-0.5'} ${theme === 'dark' ? 'bg-black' : 'bg-white'}`} />
          </div>
        </button>
      </div>

      <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: bgCard, border: `1px solid ${borderColor}` }}>
        <div className="text-[0.95rem] sm:text-[1rem] font-semibold mb-4" style={{ color: textPrimary }}>Sonido y vibración</div>
        
        <button
          onClick={() => setVibration(!vibration)}
          className="w-full flex items-center justify-between py-2 border-b"
          style={{ borderColor }}
        >
          <div className="text-left">
            <div className="text-[0.9rem] sm:text-[0.95rem]" style={{ color: textPrimary }}>Vibración</div>
            <div className="text-[0.7rem]" style={{ color: textMuted }}>Vibrar al completar serie</div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${vibration ? 'bg-[#c8ff00]' : 'bg-[#3a3a42]'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-transform ${vibration ? 'left-[22px]' : 'left-0.5'} ${vibration ? 'bg-black' : 'bg-white'}`} />
          </div>
        </button>

        <button
          onClick={() => setSound(!sound)}
          className="w-full flex items-center justify-between py-2"
        >
          <div className="text-left">
            <div className="text-[0.9rem] sm:text-[0.95rem]" style={{ color: textPrimary }}>Sonido</div>
            <div className="text-[0.7rem]" style={{ color: textMuted }}>Reproducir sonido al completar serie</div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${sound ? 'bg-[#c8ff00]' : 'bg-[#3a3a42]'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-transform ${sound ? 'left-[22px]' : 'left-0.5'} ${sound ? 'bg-black' : 'bg-white'}`} />
          </div>
        </button>
      </div>

      <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: bgCard, border: `1px solid ${borderColor}` }}>
        <div className="text-[0.95rem] sm:text-[1rem] font-semibold mb-3" style={{ color: textPrimary }}>Temporizador de descanso</div>
        
        <div className="py-1">
          <div className="text-[0.85rem] sm:text-[0.95rem] mb-3" style={{ color: textSecondary }}>Tiempo por defecto: {restTimerDefault}s</div>
          <input
            type="range"
            min="30"
            max="300"
            step="15"
            value={restTimerDefault}
            onChange={(e) => setRestTimerDefault(parseInt(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#c8ff00]"
            style={{ background: theme === 'light' ? '#d1d1d1' : '#3a3a42' }}
          />
          <div className="flex justify-between text-[0.65rem] mt-1" style={{ color: textMuted }}>
            <span>30s</span>
            <span>1:30</span>
            <span>3:00</span>
            <span>5:00</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => signOut()}
        className="w-full rounded-2xl p-4 mb-3 cursor-pointer border"
        style={{ backgroundColor: bgCard, borderColor, color: '#ff5252' }}
      >
        <div className="text-[0.95rem] sm:text-[1rem] font-semibold">Cerrar sesión</div>
        <div className="text-[0.7rem]" style={{ color: textMuted }}>Salir de tu cuenta</div>
      </button>

      <div className="rounded-2xl p-4" style={{ backgroundColor: bgCard, border: `1px solid ${borderColor}` }}>
        <div className="text-[0.95rem] sm:text-[1rem] font-semibold mb-2" style={{ color: textPrimary }}>Acerca de</div>
        <div className="text-[0.8rem] sm:text-[0.85rem]" style={{ color: textMuted }}>GymLog v1.2</div>
        <div className="text-[0.7rem] mt-2" style={{ color: theme === 'light' ? '#a0a0a8' : '#404048' }}>Tu compañero de entrenamiento</div>
      </div>
    </Layout>
  );
}
