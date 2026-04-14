import { useEffect, useRef, useCallback } from 'react';

export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const acquireWakeLock = useCallback(async () => {
    if (!enabled) return;

    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('[WakeLock] No se pudo adquirir:', err);
    }
  }, [enabled]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        acquireWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      releaseWakeLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, acquireWakeLock, releaseWakeLock]);

  return { wakeLockRef };
}
