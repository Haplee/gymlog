import { useState, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [isRevealing, setIsRevealing] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);
  const { signIn, signUp } = useAuthStore();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRevealStart = () => setIsRevealing(true);
  const handleRevealEnd = () => {
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = window.setTimeout(() => setIsRevealing(false), 500);
  };

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
      <div className="text-center mb-6">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <svg className="w-6 h-6 text-lime-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6.5 6.5h11M6.5 17.5h11M4 9.5h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z" />
            <path d="M18 9.5h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z" />
            <path d="M6.5 8v8M17.5 8v8" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white">GymLog</h1>
        <p className="text-zinc-500 text-sm mt-1">{isSignUp ? 'Crea tu cuenta' : 'Inicia sesión'}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-[280px] space-y-3">
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
            onFocus={() => { setFocusedField('password'); handleRevealStart(); }}
            onBlur={() => { setFocusedField(null); handleRevealEnd(); }}
            className={`w-full bg-zinc-900 border rounded-lg text-white text-base py-3 px-3 outline-none transition-colors pr-10 ${
              focusedField === 'password' ? 'border-lime-400' : 'border-zinc-800'
            }`}
            placeholder="Contraseña"
          />
          <button
            type="button"
            onMouseDown={handleRevealStart}
            onMouseUp={handleRevealEnd}
            onMouseLeave={handleRevealEnd}
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
          className="w-full py-3 bg-lime-400 text-black rounded-lg text-base font-semibold disabled:opacity-50"
        >
          {loading ? '...' : isSignUp ? 'Crear cuenta' : 'Entrar'}
        </button>

        {/* Toggle */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); setFullName(''); setUsername(''); }}
            className="text-lime-400 text-sm bg-transparent border-none"
          >
            {isSignUp ? '¿Ya tienes cuenta?' : '¿Sin cuenta?'}
          </button>
        </div>
      </form>

      <p className="text-zinc-600 text-xs mt-6">Tus datos están seguros</p>
    </div>
  );
}