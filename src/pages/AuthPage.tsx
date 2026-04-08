import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [isRevealing, setIsRevealing] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { signIn, signUp, signInWithGoogle } = useAuthStore();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className={`text-center mb-6 ${mounted ? 'bounce-in' : 'opacity-0'}`}>
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg shadow-lime-400/10">
          <svg className="w-7 h-7 text-lime-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6.5 6.5h11M6.5 17.5h11M4 9.5h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z" />
            <path d="M18 9.5h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z" />
            <path d="M6.5 8v8M17.5 8v8" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">GymLog</h1>
        <p className="text-zinc-500 text-sm mt-2">{isSignUp ? 'Crea tu cuenta' : 'Inicia sesión'}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className={`w-full max-w-[280px] space-y-3 ${mounted ? 'slide-up' : 'opacity-0'}`}>
        {/* Name (only for signup) */}
        {isSignUp && (
          <div className="relative">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onFocus={() => setFocusedField('fullName')}
              onBlur={() => setFocusedField(null)}
              className={`w-full bg-zinc-900 border rounded-lg text-white text-base py-3 px-3 outline-none transition-colors ${
                focusedField === 'fullName' ? 'border-lime-400' : 'border-zinc-800'
              }`}
              placeholder="Nombre completo"
            />
          </div>
        )}

        {/* Username (only for signup) */}
        {isSignUp && (
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField(null)}
              className={`w-full bg-zinc-900 border rounded-lg text-white text-base py-3 px-3 outline-none transition-colors ${
                focusedField === 'username' ? 'border-lime-400' : 'border-zinc-800'
              }`}
              placeholder="Nombre de usuario"
            />
          </div>
        )}

        {/* Email */}
        <div className="relative">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            className={`w-full bg-zinc-900 border rounded-lg text-white text-base py-3 px-3 outline-none transition-colors ${
              focusedField === 'email' ? 'border-lime-400' : 'border-zinc-800'
            }`}
            placeholder="Email"
          />
        </div>

        {/* Password */}
        <div className="relative">
          <input
            type={isRevealing ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full bg-zinc-900 border rounded-lg text-white text-base py-3 px-3 outline-none transition-colors pr-10 ${
              focusedField === 'password' ? 'border-lime-400' : 'border-zinc-800'
            }`}
            placeholder="Contraseña"
          />
          <button
            type="button"
            onClick={() => setIsRevealing(!isRevealing)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 bg-transparent border-none p-1"
          >
            {isRevealing ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* Error */}
        {error && <div className="text-red-500 text-sm px-1">{error}</div>}
        {message && <div className="text-lime-400 text-sm px-1">{message}</div>}

        {/* Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-lime-400 text-black rounded-lg text-base font-bold disabled:opacity-50 transition-transform active:scale-[0.98]"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando...
            </span>
          ) : isSignUp ? 'Crear cuenta' : 'Entrar'}
        </button>

        {/* Google divider */}
        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-zinc-800"></div>
          <span className="flex-shrink-0 mx-4 text-zinc-600 text-xs">o</span>
          <div className="flex-grow border-t border-zinc-800"></div>
        </div>

        {/* Google button */}
        <button
          type="button"
          onClick={signInWithGoogle}
          className="w-full py-3 bg-zinc-900 border border-zinc-800 text-white rounded-lg text-base flex items-center justify-center gap-2 transition-colors hover:bg-zinc-800"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar con Google
        </button>

        {/* Toggle */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); setFullName(''); setUsername(''); }}
            className="text-lime-400 text-sm bg-transparent border-none hover:underline"
          >
            {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿Sin cuenta? Crea una'}
          </button>
        </div>
      </form>

      <p className="text-zinc-600 text-xs mt-8">Tus datos están seguros</p>
    </div>
  );
}