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
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  return (
    <Layout>
      <div className="text-[1.1rem] sm:text-[1.2rem] font-extrabold mb-4 text-[#c8ff00] px-1">Configuración</div>

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-3">
        <div className="text-[0.95rem] sm:text-[1rem] font-semibold mb-4">Apariencia</div>
        
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center justify-between py-2"
        >
          <div className="text-left">
            <div className="text-[0.9rem] sm:text-[0.95rem]">Tema oscuro</div>
            <div className="text-[0.7rem] text-[#606068]">Usar modo oscuro</div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${theme === 'dark' ? 'bg-[#c8ff00]' : 'bg-[#3a3a42]'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-transform ${theme === 'dark' ? 'left-[22px]' : 'left-0.5'} ${theme === 'dark' ? 'bg-black' : 'bg-white'}`} />
          </div>
        </button>
      </div>

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-3">
        <div className="text-[0.95rem] sm:text-[1rem] font-semibold mb-4">Sonido y vibración</div>
        
        <button
          onClick={() => setVibration(!vibration)}
          className="w-full flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.06)]"
        >
          <div className="text-left">
            <div className="text-[0.9rem] sm:text-[0.95rem]">Vibración</div>
            <div className="text-[0.7rem] text-[#606068]">Vibrar al completar serie</div>
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
            <div className="text-[0.9rem] sm:text-[0.95rem]">Sonido</div>
            <div className="text-[0.7rem] text-[#606068]">Reproducir sonido al completar serie</div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${sound ? 'bg-[#c8ff00]' : 'bg-[#3a3a42]'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-transform ${sound ? 'left-[22px]' : 'left-0.5'} ${sound ? 'bg-black' : 'bg-white'}`} />
          </div>
        </button>
      </div>

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-3">
        <div className="text-[0.95rem] sm:text-[1rem] font-semibold mb-3">Temporizador de descanso</div>
        
        <div className="py-1">
          <div className="text-[0.85rem] sm:text-[0.95rem] mb-3 text-[#a0a0a8]">Tiempo por defecto: {restTimerDefault}s</div>
          <input
            type="range"
            min="30"
            max="300"
            step="15"
            value={restTimerDefault}
            onChange={(e) => setRestTimerDefault(parseInt(e.target.value))}
            className="w-full h-2 bg-[#3a3a42] rounded-lg appearance-none cursor-pointer accent-[#c8ff00]"
          />
          <div className="flex justify-between text-[0.65rem] text-[#606068] mt-1">
            <span>30s</span>
            <span>1:30</span>
            <span>3:00</span>
            <span>5:00</span>
          </div>
        </div>
      </div>

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4">
        <div className="text-[0.95rem] sm:text-[1rem] font-semibold mb-2">Acerca de</div>
        <div className="text-[0.8rem] sm:text-[0.85rem] text-[#606068]">GymLog v1.0.0</div>
        <div className="text-[0.7rem] text-[#404048] mt-2">Tu compañero de entrenamiento</div>
      </div>
    </Layout>
  );
}
