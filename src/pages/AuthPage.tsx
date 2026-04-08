import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [isRevealing, setIsRevealing] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const { signIn, signUp, signInWithGoogle } = useAuthStore();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    
    if (!email || !password) {
      setError('Completa los campos');
      setLoading(false);
      return;
    }

    if (isSignUp && (!fullName || !username)) {
      setError('Completa tu nombre y usuario');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const result = await signUp(email, password, fullName, username);
        if (result.error) setError(result.error.message);
        else if (result.needsVerification) setMessage('¡Verifica tu email!');
      } else {
        const result = await signIn(email, password);
        if (result.error) setError(result.error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } finally {
      setGoogleLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setMessage('');
    setFullName('');
    setUsername('');
    setAnimKey(prev => prev + 1);
  };

  const bgColor = '#0a0a0c';
  const cardBg = '#141418';
  const border = 'rgba(255,255,255,0.12)';
  const accent = '#c8ff00';
  const textPrimary = '#fafafa';
  const textMuted = '#606068';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: bgColor }}>
      <div className="text-center mb-8 scale-in">
        <div 
          className="w-16 h-16 mx-auto mb-4 rounded-2xl shadow-lg"
          style={{ 
            backgroundColor: accent,
            boxShadow: `0 0 30px ${accent}40`
          }}
        >
          <img src="/gimnasia.png" alt="GymLog" className="w-full h-full rounded-2xl object-contain" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight fade-in-up" style={{ color: textPrimary, animationDelay: '0.1s' }}>
          Gym<span style={{ color: accent }}>Log</span>
        </h1>
        <p className="text-sm mt-2 fade-in-up" style={{ color: textMuted, animationDelay: '0.2s' }}>
          {isSignUp ? 'Crea tu cuenta' : 'Inicia sesión'}
        </p>
      </div>

      <form onSubmit={handleSubmit} key={animKey} className="w-full max-w-[300px] space-y-4 fade-in-up" style={{ animationDelay: '0.3s' }}>
        {isSignUp && (
          <div className="fade-in-up" style={{ animationDelay: '0.15s' }}>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onFocus={() => setFocusedField('fullName')}
              onBlur={() => setFocusedField(null)}
              className="w-full rounded-xl text-base py-3.5 px-4 outline-none transition-all"
              style={{ 
                backgroundColor: cardBg, 
                border: `1px solid ${focusedField === 'fullName' ? accent : border}`, 
                color: textPrimary,
                boxShadow: focusedField === fullName ? `0 0 0 2px ${accent}30` : 'none'
              }}
              placeholder="Nombre completo"
            />
          </div>
        )}

        {isSignUp && (
          <div className="fade-in-up" style={{ animationDelay: '0.2s' }}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField(null)}
              className="w-full rounded-xl text-base py-3.5 px-4 outline-none transition-all"
              style={{ 
                backgroundColor: cardBg, 
                border: `1px solid ${focusedField === 'username' ? accent : border}`, 
                color: textPrimary,
                boxShadow: focusedField === 'username' ? `0 0 0 2px ${accent}30` : 'none'
              }}
              placeholder="Nombre de usuario"
            />
          </div>
        )}

        <div className="fade-in-up" style={{ animationDelay: '0.25s' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            className="w-full rounded-xl text-base py-3.5 px-4 outline-none transition-all"
            style={{ 
              backgroundColor: cardBg, 
              border: `1px solid ${focusedField === 'email' ? accent : border}`, 
              color: textPrimary,
              boxShadow: focusedField === 'email' ? `0 0 0 2px ${accent}30` : 'none'
            }}
            placeholder="Email"
          />
        </div>

        <div className="fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="relative">
            <input
              type={isRevealing ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              className="w-full rounded-xl text-base py-3.5 px-4 outline-none transition-all pr-12"
              style={{ 
                backgroundColor: cardBg, 
                border: `1px solid ${focusedField === 'password' ? accent : border}`, 
                color: textPrimary,
                boxShadow: focusedField === 'password' ? `0 0 0 2px ${accent}30` : 'none'
              }}
              placeholder="Contraseña"
            />
            <button
              type="button"
              onClick={() => setIsRevealing(!isRevealing)}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none p-1 transition-all hover:scale-110"
              style={{ color: textMuted }}
            >
              {isRevealing ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="fade-in-up text-center text-sm py-2 rounded-lg error-shake" style={{ backgroundColor: 'rgba(255,82,82,0.1)', color: '#ff5252' }}>
            {error}
          </div>
        )}
        
        {message && (
          <div className="fade-in-up text-center text-sm py-2 rounded-lg success-pulse" style={{ backgroundColor: `${accent}20`, color: accent }}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-xl text-base font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: accent, color: '#0a0a0c' }}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando...
            </span>
          ) : isSignUp ? 'Crear cuenta' : 'Entrar'}
        </button>

        <div className="relative flex items-center py-2">
          <div className="flex-grow" style={{ borderTop: `1px solid ${border}` }}></div>
          <span className="mx-4 text-xs" style={{ color: textMuted }}>o</span>
          <div className="flex-grow" style={{ borderTop: `1px solid ${border}` }}></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full py-4 rounded-xl text-base flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: cardBg, border: `1px solid ${border}`, color: textPrimary }}
        >
          {googleLoading ? (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Continuar con Google
        </button>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={toggleMode}
            className="text-sm bg-transparent border-none transition-all hover:scale-105"
            style={{ color: accent }}
          >
            {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿Sin cuenta? Crea una'}
          </button>
        </div>
      </form>

      <p className="text-xs mt-8 fade-in-up" style={{ color: textMuted, animationDelay: '0.5s' }}>Tus datos están seguros</p>
    </div>
  );
}
