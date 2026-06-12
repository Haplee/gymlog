import { useEffect } from 'react';
import { useAuthStore } from '@features/auth/stores/authStore';
import { checkStreakAtRisk } from '@shared/lib/streakChecker';
import { checkWeeklySummary } from '@shared/lib/weeklySummary';
import { notify } from '@shared/lib/notifications';
import { devError } from '@shared/lib/devtools';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
/** Hora a partir de la cual avisar de racha en peligro */
const STREAK_ALERT_HOUR = 20;

export function useBackgroundNotifications() {
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;

    const runChecks = async () => {
      try {
        await checkWeeklySummary(userId);

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const streakKey = `streak_notif_${dateStr}`;

        if (now.getHours() >= STREAK_ALERT_HOUR && !localStorage.getItem(streakKey)) {
          const atRisk = await checkStreakAtRisk(userId);
          if (atRisk) {
            await notify('🔥 Tu racha está en peligro', {
              body: 'Tantos días seguidos... No lo pierdas hoy.',
              icon: '/icon-192x192.webp',
              url: '/',
            });
            localStorage.setItem(streakKey, 'true');
          }
        }
      } catch (e) {
        devError('Background notification check failed:', e);
      }
    };

    void runChecks();
    const interval = setInterval(() => void runChecks(), CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId]);
}
