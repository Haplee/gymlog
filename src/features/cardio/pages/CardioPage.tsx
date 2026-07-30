import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
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
  const user = useAuthStore((s) => s.user);
  const isActive = useCardioStore((s) => s.isActive);
  const sessions = useCardioStore((s) => s.sessions);
  const startSession = useCardioStore((s) => s.startSession);
  const deleteSession = useCardioStore((s) => s.deleteSession);
  const syncFromRemote = useCardioStore((s) => s.syncFromRemote);

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
          {/* Rejilla en vez de fila con scroll: los 8 tipos se ven de un vistazo
              sin deslizar, y cada uno lleva su etiqueta para que se reconozca. */}
          <div className="grid grid-cols-4 gap-2">
            {CARDIO_TYPES.map((type) => (
              <button
                type="button"
                key={type}
                onClick={() => handleStart(type)}
                aria-label={CARDIO_LABELS[type]}
                className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-colors active:scale-95 bg-surface-2 text-accent"
              >
                <CardioTypeIcon type={type} className="w-7 h-7" />
                <span className="text-[11px] font-medium leading-none text-fg-muted">
                  {CARDIO_LABELS[type]}
                </span>
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
