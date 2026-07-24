import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { Fingerprint } from 'lucide-react';
import BiometricPlugin from '@shared/lib/biometric';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { devError } from '@shared/lib/devtools';

type Status = 'idle' | 'verifying' | 'error';

/**
 * Pantalla de bloqueo biométrico. Se muestra por encima de la app cuando el
 * usuario ha activado el acceso biométrico (Ajustes) y arranca o vuelve del
 * segundo plano. Lanza el prompt nativo sola al montar y, si el usuario lo
 * cancela o falla, deja el sensor a un toque de distancia con opción de
 * reintentar. La animación de anillos + halo busca dar sensación "premium".
 */
export function AppLockGate({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  // Arranca en 'verifying' porque el prompt se lanza solo al montar; así el
  // efecto no necesita un setState síncrono (solo escribe en callbacks async).
  const [status, setStatus] = useState<Status>('verifying');

  const runAuth = useCallback(async () => {
    try {
      const res = await BiometricPlugin.authenticate();
      if (res.success) {
        void impact(ImpactStyle.Medium);
        onUnlock();
      } else {
        setStatus('error');
      }
    } catch (e) {
      devError('[AppLock] authenticate:', e);
      setStatus('error');
    }
  }, [onUnlock]);

  // Reintento manual (toque en la huella o botón): sí puede fijar 'verifying'
  // porque corre desde un evento, no desde el render del efecto.
  const retry = useCallback(() => {
    setStatus('verifying');
    void runAuth();
  }, [runAuth]);

  // Auto-lanza el prompt al montar: la app premium no obliga a un toque extra.
  // Se hace inline (no vía runAuth) para que el setState quede tras el await y
  // no se lea como un cambio de estado síncrono dentro del efecto.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await BiometricPlugin.authenticate();
        if (cancelled) return;
        if (res.success) {
          void impact(ImpactStyle.Medium);
          onUnlock();
        } else {
          setStatus('error');
        }
      } catch (e) {
        if (cancelled) return;
        devError('[AppLock] authenticate:', e);
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onUnlock]);

  const verifying = status === 'verifying';
  const errored = status === 'error';

  return (
    <m.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-9 bg-canvas px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <m.p
        className="font-display text-xl font-bold tracking-tight text-fg"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        GymLog
      </m.p>

      <button
        type="button"
        onClick={retry}
        aria-label={t('settings.biometric_unlock')}
        className="relative flex h-44 w-44 items-center justify-center focus-visible:outline-none"
      >
        {/* Anillos "sonar" mientras verifica */}
        {verifying &&
          [0, 0.6, 1.2].map((delay) => (
            <m.span
              key={delay}
              className="absolute h-24 w-24 rounded-full border border-accent"
              initial={{ scale: 0.85, opacity: 0.45 }}
              animate={{ scale: 1.75, opacity: 0 }}
              transition={{ duration: 1.8, delay, repeat: Infinity, ease: 'easeOut' }}
            />
          ))}
        {/* Halo difuso en color de acento */}
        <div className="absolute h-28 w-28 rounded-full bg-accent/15 blur-2xl" />
        {/* Disco central con la huella */}
        <m.span
          className="relative flex h-24 w-24 items-center justify-center rounded-full bg-surface-2 text-accent shadow-fab"
          animate={errored ? { x: [0, -9, 9, -6, 6, 0] } : { scale: verifying ? [1, 1.06, 1] : 1 }}
          transition={
            errored
              ? { duration: 0.4 }
              : { duration: 1.6, repeat: verifying ? Infinity : 0, ease: 'easeInOut' }
          }
        >
          <Fingerprint className="h-11 w-11" strokeWidth={1.5} />
        </m.span>
      </button>

      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-base font-semibold text-fg">{t('settings.biometric_locked_title')}</p>
        <p className="text-sm text-fg-muted">
          {errored ? t('settings.biometric_failed') : t('settings.biometric_locked_hint')}
        </p>
        {errored && (
          <button
            type="button"
            onClick={retry}
            className="mt-2 rounded-pill bg-accent px-7 py-2.5 text-sm font-semibold text-accent-fg shadow-btn-accent active:scale-[0.97]"
          >
            {t('settings.biometric_retry')}
          </button>
        )}
      </div>
    </m.div>
  );
}
