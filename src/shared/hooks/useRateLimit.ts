import { useState, useCallback, useRef } from 'react';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutos

interface RateLimitState {
  /** Segundos restantes de bloqueo (0 = no bloqueado) */
  cooldownSeconds: number;
  /** Si está actualmente bloqueado */
  isBlocked: boolean;
  /** Registra un intento. Devuelve false si está bloqueado. */
  recordAttempt: () => boolean;
  /** Resetea el contador (tras login exitoso) */
  reset: () => void;
}

/**
 * Hook de rate limiting para formularios de autenticación.
 * Máximo 5 intentos en 5 minutos. Cuenta regresiva al bloquearse.
 *
 * @returns Estado de bloqueo y función recordAttempt
 *
 * @example
 * const { isBlocked, cooldownSeconds, recordAttempt } = useRateLimit();
 * const allowed = recordAttempt();
 * if (!allowed) return; // bloqueado
 */
export function useRateLimit(): RateLimitState {
  const attempts = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startCooldown = useCallback((remainingMs: number) => {
    clearTimer();
    setCooldownSeconds(Math.ceil(remainingMs / 1000));

    timerRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearTimer();
          attempts.current = [];
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const recordAttempt = useCallback((): boolean => {
    const now = Date.now();

    // Limpiar intentos fuera de la ventana
    attempts.current = attempts.current.filter((t) => now - t < WINDOW_MS);

    if (attempts.current.length >= MAX_ATTEMPTS) {
      const oldest = attempts.current[0];
      if (oldest !== undefined) {
        const remaining = WINDOW_MS - (now - oldest);
        startCooldown(remaining);
      }
      return false;
    }

    attempts.current.push(now);

    if (attempts.current.length >= MAX_ATTEMPTS) {
      const oldest = attempts.current[0];
      if (oldest !== undefined) {
        startCooldown(WINDOW_MS);
      }
    }

    return true;
  }, [startCooldown]);

  const reset = useCallback(() => {
    clearTimer();
    attempts.current = [];
    setCooldownSeconds(0);
  }, []);

  return {
    cooldownSeconds,
    isBlocked: cooldownSeconds > 0,
    recordAttempt,
    reset,
  };
}
