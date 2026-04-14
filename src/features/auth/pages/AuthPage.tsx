import { useState } from 'react';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useRateLimit } from '@shared/hooks/useRateLimit';

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [isRevealing, setIsRevealing] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const { signIn, signUp, signInWithGoogle } = useAuthStore();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { isBlocked, cooldownSeconds, recordAttempt, reset } = useRateLimit();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (isBlocked) {
      setError(`Demasiados intentos. Espera ${cooldownSeconds}s`);
      return;
    }

    if (!email || !password) {
      setError('Completa los campos');
      return;
    }

    if (isSignUp && (!fullName || !username)) {
      setError('Completa tu nombre y usuario');
      return;
    }

    if (!recordAttempt()) {
      setError(`Demasiados intentos. Espera ${cooldownSeconds}s`);
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const result = await signUp(email, password, fullName, username);
        if (result.error) setError(result.error.message);
        else if (result.needsVerification) setMessage('¡Verifica tu email!');
        else reset();
      } else {
        const result = await signIn(email, password);
        if (result.error) setError(result.error.message);
        else reset();
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
    setAnimKey((prev) => prev + 1);
  };

  const accent = '#c8ff00';

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-[var(--bg-base)]">
      <div className="text-center mb-8 scale-in">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-[var(--radius-lg)] flex items-center justify-center"
          style={{ backgroundColor: accent, boxShadow: `0 0 30px ${accent}40` }}
        >
          <img
            src="/gimnasia.png"
            alt="GymLog"
            className="w-full h-full rounded-[var(--radius-lg)] object-contain"
          />
        </div>
        <h1 className="text-[1.875rem] font-extrabold tracking-tight fade-in-up text-[var(--text-primary)]">
          Gym<span style={{ color: accent }}>Log</span>
        </h1>
        <p className="text-[0.875rem] mt-2 fade-in-up text-[var(--text-tertiary)]">
          {isSignUp ? 'Crea tu cuenta' : 'Inicia sesión'}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        key={animKey}
        className="w-full max-w-[300px] space-y-4 fade-in-up"
      >
        {isSignUp && (
          <div className="fade-in-up">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-[var(--radius-lg)] text-base py-3.5 px-4 outline-none transition-all bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--interactive-primary)] focus:shadow-[0_0_0_2px_var(--interactive-primary)]/30"
              placeholder="Nombre completo"
            />
          </div>
        )}

        {isSignUp && (
          <div className="fade-in-up">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-[var(--radius-lg)] text-base py-3.5 px-4 outline-none transition-all bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--interactive-primary)] focus:shadow-[0_0_0_2px_var(--interactive-primary)]/30"
              placeholder="Nombre de usuario"
            />
          </div>
        )}

        <div className="fade-in-up">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-[var(--radius-lg)] text-base py-3.5 px-4 outline-none transition-all bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--interactive-primary)] focus:shadow-[0_0_0_2px_var(--interactive-primary)]/30"
            placeholder="Email"
          />
        </div>

        <div className="fade-in-up">
          <div className="relative">
            <input
              type={isRevealing ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[var(--radius-lg)] text-base py-3.5 px-4 outline-none transition-all pr-12 bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--interactive-primary)] focus:shadow-[0_0_0_2px_var(--interactive-primary)]/30"
              placeholder="Contraseña"
            />
            <button
              type="button"
              onClick={() => setIsRevealing(!isRevealing)}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none p-1 transition-all hover:scale-110 text-[var(--text-tertiary)]"
            >
              {isRevealing ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="fade-in-up text-center text-sm py-2 rounded-[var(--radius-md)] bg-[var(--error)]/10 text-[var(--error)] error-shake">
            {error}
          </div>
        )}

        {message && (
          <div className="fade-in-up text-center text-sm py-2 rounded-[var(--radius-md)] bg-[var(--success)]/10 text-[var(--success)] success-pulse">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || isBlocked}
          aria-label={
            isBlocked
              ? `Bloqueado ${cooldownSeconds}s`
              : isSignUp
                ? 'Crear cuenta'
                : 'Iniciar sesión'
          }
          className="w-full py-4 rounded-[var(--radius-lg)] text-base font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: isBlocked ? '#444' : accent, color: '#0a0a0c' }}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Cargando...
            </span>
          ) : isBlocked ? (
            `Espera ${cooldownSeconds}s`
          ) : isSignUp ? (
            'Crear cuenta'
          ) : (
            'Entrar'
          )}
        </button>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-[var(--border-default)]"></div>
          <span className="mx-4 text-xs text-[var(--text-tertiary)]">o</span>
          <div className="flex-grow border-t border-[var(--border-default)]"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full py-4 rounded-[var(--radius-lg)] text-base flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)]"
        >
          {googleLoading ? (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
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

      <p className="text-xs mt-8 fade-in-up text-[var(--text-tertiary)]">Tus datos están seguros</p>
    </div>
  );
}
