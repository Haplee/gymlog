import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Capacitor } from '@capacitor/core';
import { m, type Variants } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useTranslation } from 'react-i18next';
import { useRateLimit } from '@shared/hooks/useRateLimit';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { checkPasswordStrength } from '@shared/lib/passwordStrength';
import { Download, Eye, EyeOff } from '@shared/components/icons';
import { Button, Input } from '@shared/components/ui';
import { APK_DOWNLOAD_URL } from '@shared/constants/links';

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 26 } },
};

/**
 * Login y registro.
 *
 * Se viste con el mismo material que el resto de la app: el formulario vive en
 * una tarjeta de vidrio (`glass-2`) y usa las primitivas Input y Button, así que
 * los campos y los botones son píldoras como en cualquier otra pantalla. Antes
 * era la única pantalla que seguía en el lenguaje «Stitch» —rejilla ambiental de
 * fondo, campos de solo subrayado y botones de esquina cuadrada—, que es
 * justamente la primera impresión de la app.
 *
 * El halo de fondo sale de `--accent-rgb`, así que sigue al acento que elija el
 * usuario en vez de quedarse fijo en un color.
 */
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
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
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
      setError(t('auth.error_rate_limited', { seconds: cooldownSeconds }));
      return;
    }

    if (!email || !password) {
      setError(t('auth.error_fill_fields'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.error_password_short'));
      return;
    }

    if (isSignUp && (!fullName || !username)) {
      setError(t('auth.error_fill_profile'));
      return;
    }

    if (isSignUp && username.length < 3) {
      setError(t('auth.error_username_short'));
      return;
    }

    // Registro: fuerza de contraseña en cliente (mitigación de HIBP, plan Free).
    if (isSignUp) {
      const pw = checkPasswordStrength(password);
      if (!pw.ok) {
        setError(pw.message ?? t('auth.error_password_invalid'));
        return;
      }
    }

    if (!recordAttempt()) {
      setError(t('auth.error_rate_limited', { seconds: cooldownSeconds }));
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const result = await signUp(email, password, fullName, username);
        if (result.error) setError(result.error.message);
        else if (result.needsVerification) setMessage(t('auth.verification'));
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

  const submitLabel = isBlocked
    ? t('auth.wait_seconds', { seconds: cooldownSeconds })
    : isSignUp
      ? t('auth.signup')
      : t('auth.login');

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-canvas px-5">
      {/* Halo de acento. Sustituye a la rejilla ambiental de la etapa Stitch:
          sigue al acento elegido y es el mismo recurso que usa el body. */}
      <m.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 55% at 50% 0%, rgb(var(--accent-rgb) / 0.1), transparent 65%)',
        }}
      />

      <m.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-6"
      >
        <m.div variants={rise}>
          <h1 className="select-none font-display text-display-huge text-fg">GYMLOG</h1>
          <p className="label-caps mt-2 text-accent">{t('auth.subtitle')}</p>
        </m.div>

        <m.form
          variants={stagger}
          initial="hidden"
          animate="show"
          onSubmit={handleSubmit}
          key={animKey}
          className="glass-2 flex flex-col gap-4 rounded-card p-5"
        >
          {isSignUp && (
            <m.div variants={rise}>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('auth.name')}
                aria-label={t('auth.name')}
                autoComplete="name"
              />
            </m.div>
          )}

          {isSignUp && (
            <m.div variants={rise}>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('auth.username')}
                aria-label={t('auth.username')}
                autoComplete="username"
              />
            </m.div>
          )}

          <m.div variants={rise}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email')}
              aria-label={t('auth.email')}
              autoComplete="email"
            />
          </m.div>

          <m.div variants={rise}>
            <Input
              type={isRevealing ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.password')}
              aria-label={t('auth.password')}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className="pr-14"
              iconRight={
                <button
                  type="button"
                  onClick={() => setIsRevealing(!isRevealing)}
                  aria-label={isRevealing ? t('auth.hide_password') : t('auth.show_password')}
                  className="-mr-2 flex size-11 items-center justify-center rounded-full text-fg-subtle transition-colors hover:text-fg"
                >
                  {isRevealing ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              }
            />
          </m.div>

          {error && (
            <m.div
              role="alert"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="error-shake rounded-card border border-error/25 bg-error/10 px-4 py-2.5 text-center text-sm text-error"
            >
              {error}
            </m.div>
          )}

          {message && (
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="success-pulse rounded-card border border-success/25 bg-success/10 px-4 py-2.5 text-center text-sm text-success"
            >
              {message}
            </m.div>
          )}

          <m.div variants={rise}>
            <Button
              type="submit"
              size="lg"
              loading={loading}
              disabled={isBlocked}
              className="w-full"
            >
              {loading ? t('auth.loading') : submitLabel}
            </Button>
          </m.div>

          <m.div variants={rise} className="flex items-center py-0.5">
            <div className="hairline-separator grow" />
            <span className="label-caps mx-4 text-fg-subtle">{t('auth.or')}</span>
            <div className="hairline-separator grow" />
          </m.div>

          <m.div variants={rise}>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleGoogleLogin}
              loading={googleLoading}
              className="w-full"
            >
              {!googleLoading && <GoogleMark />}
              {t('auth.signin_google')}
            </Button>
          </m.div>
        </m.form>

        <m.div variants={rise} className="text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="inline-flex min-h-11 items-center justify-center border-none bg-transparent px-3 text-sm text-accent transition-colors hover:text-accent-dim"
          >
            {isSignUp ? t('auth.switch_login') : t('auth.switch_signup')}
          </button>
        </m.div>
      </m.div>

      <m.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="relative mx-auto flex w-full max-w-sm items-center justify-between pb-4 pt-2"
      >
        <div className="flex items-center gap-1">
          {(['en', 'es'] as const).map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => setLanguage(lng)}
              aria-pressed={language === lng}
              className={`label-caps min-h-11 min-w-11 rounded-pill px-4 py-2.5 transition-colors ${
                language === lng ? 'text-accent' : 'text-fg-subtle hover:text-fg-muted'
              }`}
            >
              {lng.toUpperCase()}
            </button>
          ))}
        </div>
        {/* En la app nativa ofrecería descargar el APK que ya se está ejecutando. */}
        {!Capacitor.isNativePlatform() && (
          <a
            href={APK_DOWNLOAD_URL}
            className="label-caps inline-flex min-h-11 items-center gap-2 rounded-pill px-3 py-2.5 text-fg-subtle transition-colors hover:text-fg-muted"
          >
            <Download size={16} />
            {t('auth.download_apk')}
          </a>
        )}
      </m.footer>
    </div>
  );
}

/**
 * Logotipo de Google. Es de las pocas excepciones a "nada de hex en JSX": son
 * los colores de marca de un tercero y no pueden seguir al tema ni al acento.
 */
function GoogleMark() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
  );
}
