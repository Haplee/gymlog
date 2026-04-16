import { useEffect } from 'react';
import { useAuthStore } from '@features/auth/stores/authStore';
import { checkStreakAtRisk } from '@shared/lib/streakChecker';
import { checkWeeklySummary } from '@shared/lib/weeklySummary';
import { notify } from '@shared/lib/notifications';

export function useBackgroundNotifications() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    // Run immediately on mount
    const runChecks = async () => {
      try {
        await checkWeeklySummary(user.id);

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const streakKey = `streak_notif_${dateStr}`;

        if (now.getHours() >= 20 && !localStorage.getItem(streakKey)) {
          const atRisk = await checkStreakAtRisk(user.id);
          if (atRisk) {
            notify('🔥 Tu racha está en peligro', {
              body: 'Tantos días seguidos... No lo pierdas hoy.',
              icon: '/icons/icon-192x192.png',
              url: '/workout',
            });
            localStorage.setItem(streakKey, 'true');
          }
        }
      } catch (e) {
        console.error('Background notification check failed:', e);
      }
    };

    runChecks();

    // Check every 30 mins
    const interval = setInterval(runChecks, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);
}
