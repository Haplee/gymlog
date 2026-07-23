import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { Layout } from '@app/components/Layout';
import {
  useCardioStore,
  CARDIO_LABELS,
  type CardioType,
} from '@features/cardio/stores/cardioStore';
import { CardioTypeIcon } from '@shared/components/CardioIcons';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { SectionHeader } from '@shared/components/ui';
import { ActiveSessionCard } from '@features/cardio/components/ActiveSessionCard';
import { WeeklyStats } from '@features/cardio/components/WeeklyStats';
import { SessionHistoryItem } from '@features/cardio/components/SessionHistoryItem';

const CARDIO_TYPES: CardioType[] = [
  'running',
  'cycling',
  'walking',
  'rowing',
  'swimming',
  'elliptical',
  'jump_rope',
  'other',
];

export function CardioPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isActive, startSession, sessions, deleteSession, syncFromRemote } = useCardioStore();

  useEffect(() => {
    if (!user) navigate('/login');
    else void syncFromRemote(user.id);
  }, [user, navigate, syncFromRemote]);

  const handleStart = useCallback(
    (type: CardioType) => {
      if (isActive) return;
      startSession(type);
      void impact(ImpactStyle.Medium);
    },
    [isActive, startSession],
  );

  return (
    <Layout>
      <WeeklyStats sessions={sessions} />

      <ActiveSessionCard userId={user?.id ?? null} />

      {!isActive && (
        <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <SectionHeader title={t('cardio.start_session')} />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CARDIO_TYPES.map((type) => (
              <button
                type="button"
                key={type}
                onClick={() => handleStart(type)}
                aria-label={CARDIO_LABELS[type]}
                title={CARDIO_LABELS[type]}
                className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-colors active:scale-95 bg-surface-2 text-accent"
              >
                <CardioTypeIcon type={type} className="w-5 h-5" />
              </button>
            ))}
          </div>
        </m.div>
      )}

      {sessions.length > 0 && (
        <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <SectionHeader title={t('cardio.recent_activity')} />
          <div>
            {sessions.slice(0, 20).map((session) => (
              <SessionHistoryItem
                key={session.id}
                session={session}
                onDelete={() => void deleteSession(session.id, user?.id ?? null)}
              />
            ))}
          </div>
        </m.div>
      )}

      {sessions.length === 0 && !isActive && (
        <div className="text-center py-12 text-sm text-fg-subtle">{t('cardio.first_session')}</div>
      )}
    </Layout>
  );
}
