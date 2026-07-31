import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { Layout } from '@app/components/Layout';
import {
  useCardioStore,
  CARDIO_LABELS,
  CARDIO_SHORT_LABELS,
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
  const activeType = useCardioStore((s) => s.activeType);
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

      {/* Fila con scroll horizontal: entran ~5 tipos a la vista y los 8 siguen
          accesibles deslizando. Se mantiene visible durante la sesión para que
          el tipo activo quede señalado; los demás se desactivan (cambiar de
          tipo a mitad de sesión no es una función que exista). */}
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 -mx-4 px-4 overflow-x-auto"
      >
        <div className="flex gap-4 w-max">
          {CARDIO_TYPES.map((type) => {
            const selected = isActive && activeType === type;
            return (
              <button
                type="button"
                key={type}
                onClick={() => handleStart(type)}
                disabled={isActive && !selected}
                aria-label={CARDIO_LABELS[type]}
                aria-pressed={selected}
                className="flex flex-col items-center gap-2 disabled:opacity-40 transition-transform active:scale-95"
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-md border transition-colors ${
                    selected
                      ? 'border-accent bg-transparent text-accent'
                      : 'border-transparent bg-surface-2 text-fg-muted'
                  }`}
                >
                  <CardioTypeIcon type={type} className="w-7 h-7" />
                </span>
                <span className={`label-caps ${selected ? 'text-accent' : 'text-fg-subtle'}`}>
                  {CARDIO_SHORT_LABELS[type]}
                </span>
              </button>
            );
          })}
        </div>
      </m.div>

      <ActiveSessionCard userId={user?.id ?? null} />

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
