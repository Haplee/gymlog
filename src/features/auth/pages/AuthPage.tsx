import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { m, type Variants } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useTranslation } from 'react-i18next';
import { useRateLimit } from '@shared/hooks/useRateLimit';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { checkPasswordStrength } from '@shared/lib/passwordStrength';
import { Download } from 'lucide-react';

const APK_URL = 'https://github.com/Haplee/gymlog/releases/download/v0.5.0/GymLog-v0.5.0.apk';

const inputClass =
  'w-full bg-transparent border-0 border-b border-line-strong rounded-none text-base py-3 px-1 outline-none transition-colors text-fg placeholder:text-fg-subtle focus:border-accent';

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 26 } },
};

const sweep: Variants = {
  hidden: { opacity: 0, scaleX: 0 },
  show: { opacity: 1, scaleX: 1, transition: { duration: 0.5, ease: 'easeOut' } },
};

export function AuthPage() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [isRevealing, setIsRevealing] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const { t } = useTranslation();
  const { signIn, signUp, signInWithGoogle } = useAuthStore();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
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

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (isSignUp && (!fullName || !username)) {
      setError('Completa tu nombre y usuario');
      return;
    }

    if (isSignUp && username.length < 3) {
      setError('El usuario debe tener al menos 3 caracteres');
      return;
    }

    // Registro: fuerza de contraseña en cliente (mitigación de HIBP, plan Free).
    if (isSignUp) {
      const pw = checkPasswordStrength(password);
      if (!pw.ok) {
        setError(pw.message ?? 'Contraseña no válida');
        return;
      }
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
        else {
          reset();
          navigate('/', { replace: true });
        }
      } else {
        const result = await signIn(email, password);
        if (result.error) setError(result.error.message);
        else {
          reset();
          navigate('/', { replace: true });
        }
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

  return (
    <div className="relative flex-1 flex flex-col px-6 bg-base overflow-hidden">
      {/* Grid ambiental Stitch */}
      <m.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <m.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative flex-1 flex flex-col justify-center w-full max-w-sm mx-auto py-4"
      >
        <m.div variants={rise}>
          <h1 className="text-display-huge font-display text-fg select-none">GYMLOG</h1>
          <p className="label-caps text-accent mt-2">{t('auth.subtitle')}</p>
        </m.div>

        <m.div variants={sweep} className="dotted-separator my-6 origin-left" />

        <m.form
          variants={stagger}
          initial="hidden"
          animate="show"
          onSubmit={handleSubmit}
          key={animKey}
          className="space-y-4"
        >
          {isSignUp && (
            <m.input
              variants={rise}
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              placeholder={t('auth.name')}
              aria-label={t('auth.name')}
            />
          )}

          {isSignUp && (
            <m.input
              variants={rise}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              placeholder={t('auth.username')}
              aria-label={t('auth.username')}
            />
          )}

          <m.input
            variants={rise}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder={t('auth.email')}
            aria-label={t('auth.email')}
          />

          <m.div variants={rise} className="relative">
            <input
              type={isRevealing ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-12`}
              placeholder={t('auth.password')}
              aria-label={t('auth.password')}
            />
            <button
              type="button"
              onClick={() => setIsRevealing(!isRevealing)}
              aria-label={isRevealing ? t('auth.hide_password') : t('auth.show_password')}
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-transparent border-none p-2 -m-2 min-w-11 min-h-11 flex items-center justify-center text-fg-subtle transition-colors hover:text-fg"
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
          </m.div>

          {error && (
            <m.div
              role="alert"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-sm py-2.5 px-3 rounded-sm bg-error/10 border border-error/25 text-error error-shake"
            >
              {error}
            </m.div>
          )}

          {message && (
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-sm py-2.5 px-3 rounded-sm bg-success/10 border border-success/25 text-success success-pulse"
            >
              {message}
            </m.div>
          )}

          <m.button
            variants={rise}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading || isBlocked}
            className={`w-full min-h-12 rounded-sm text-sm font-display font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-50 text-accent-fg ${
              isBlocked ? 'bg-fg-subtle' : 'bg-accent shadow-btn-accent'
            }`}
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
                {t('auth.loading')}
              </span>
            ) : isBlocked ? (
              `Wait ${cooldownSeconds}s`
            ) : isSignUp ? (
              t('auth.signup')
            ) : (
              t('auth.login')
            )}
          </m.button>

          <m.div variants={rise} className="relative flex items-center py-0.5">
            <div className="flex-grow dotted-separator" />
            <span className="mx-4 label-caps text-fg-subtle">o</span>
            <div className="flex-grow dotted-separator" />
          </m.div>

          <m.button
            variants={rise}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full min-h-12 px-5 rounded-sm text-sm font-display font-bold uppercase tracking-[0.12em] flex items-center justify-between gap-3 transition-colors disabled:opacity-50 bg-surface border border-line-strong text-fg hover:border-line-accent"
          >
            <span>{t('auth.signin_google')}</span>
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
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
          </m.button>

          <m.div variants={rise} className="text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm bg-transparent border-none p-2 transition-colors text-accent hover:text-accent-dim"
            >
              {isSignUp ? t('auth.switch_login') : t('auth.switch_signup')}
            </button>
          </m.div>
        </m.form>
      </m.div>

      <m.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="relative flex items-center justify-between w-full max-w-sm mx-auto pt-2 pb-4"
      >
        <div className="flex items-center gap-1">
          {(['en', 'es'] as const).map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => setLanguage(lng)}
              aria-pressed={language === lng}
              className={`label-caps px-3 py-2.5 min-h-11 rounded-sm transition-colors ${
                language === lng ? 'text-accent' : 'text-fg-subtle hover:text-fg-muted'
              }`}
            >
              {lng.toUpperCase()}
            </button>
          ))}
        </div>
        <a
          href={APK_URL}
          className="label-caps inline-flex items-center gap-2 px-3 py-2.5 min-h-11 rounded-sm text-fg-subtle hover:text-fg-muted transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          {t('auth.download_apk')}
        </a>
      </m.footer>
    </div>
  );
}
