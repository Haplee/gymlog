import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { m, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@features/auth/stores/authStore';
import { Layout } from '@app/components/Layout';
import {
  useCardioStore,
  CARDIO_LABELS,
  type CardioType,
  type CardioSession,
} from '@features/cardio/stores/cardioStore';
import { CardioTypeIcon } from '@shared/components/CardioIcons';
import { impact, notificationHaptic, ImpactStyle, NotificationType } from '@shared/lib/haptics';
import { SectionHeader } from '@shared/components/ui';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Play, Pause, Square, Trash2, HeartPulse } from 'lucide-react';

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

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}min`;
}

function ActiveSessionCard({ userId }: { userId: string | null }) {
  const { t } = useTranslation();
  const {
    isActive,
    isPaused,
    activeType,
    pauseSession,
    resumeSession,
    stopSession,
    discardSession,
    getElapsed,
  } = useCardioStore();
  const [elapsed, setElapsed] = useState(() => getElapsed());
  const [showFinish, setShowFinish] = useState(false);
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isActive || isPaused) return;
    const id = setInterval(() => setElapsed(getElapsed()), 1000);
    return () => clearInterval(id);
  }, [isActive, isPaused, getElapsed]);

  const handleStop = () => {
    setElapsed(getElapsed());
    setShowFinish(true);
    pauseSession();
  };

  const handleSave = async () => {
    const distNum = distance ? parseFloat(distance.replace(',', '.')) : NaN;
    const calNum = calories ? parseInt(calories, 10) : NaN;
    await stopSession(userId, {
      distance: Number.isFinite(distNum) ? distNum : undefined,
      calories: Number.isFinite(calNum) ? calNum : undefined,
      notes: notes.trim() || undefined,
    });
    void notificationHaptic(NotificationType.Success);
    setShowFinish(false);
    setDistance('');
    setCalories('');
    setNotes('');
  };

  const handleDiscard = () => {
    discardSession();
    setShowFinish(false);
  };

  if (!isActive && !showFinish) return null;

  const label = activeType ? CARDIO_LABELS[activeType] : '';

  return (
    <m.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg p-4 mb-4 bg-surface border border-line"
    >
      {!showFinish ? (
        <>
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 bg-accent ${isPaused ? '' : 'pulse-soft'}`}
                  aria-hidden="true"
                />
                <span className="label-caps text-accent">
                  {label} · {isPaused ? t('cardio.paused') : t('cardio.recording')}
                </span>
              </div>
              {activeType && (
                <span className="text-accent">
                  <CardioTypeIcon type={activeType} className="w-5 h-5" />
                </span>
              )}
            </div>
            <div
              className={`mt-2 text-display-huge font-display tabular text-fg ${
                isPaused ? '' : 'timer-pulse'
              }`}
            >
              {formatSeconds(elapsed)}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (isPaused) resumeSession();
                else pauseSession();
                void impact(ImpactStyle.Light);
              }}
              className="flex-1 min-h-12 rounded-sm flex items-center justify-center gap-2 text-sm font-display font-bold uppercase tracking-[0.1em] bg-accent text-accent-fg transition-transform active:scale-[0.98]"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? t('cardio.resume') : t('cardio.pause')}
            </button>
            <button
              type="button"
              onClick={handleStop}
              className="flex-1 min-h-12 rounded-sm flex items-center justify-center gap-2 text-sm font-display font-bold uppercase tracking-[0.1em] bg-transparent border border-line-strong text-fg transition-transform active:scale-[0.98]"
            >
              <Square className="w-4 h-4" />
              {t('cardio.finish')}
            </button>
          </div>
        </>
      ) : (
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold mb-1 text-fg">
            {activeType && <CardioTypeIcon type={activeType} className="w-4 h-4" />}
            {label} · <span className="font-display tabular">{formatSeconds(elapsed)}</span>
          </div>
          <div className="text-xs mb-3 text-fg-subtle">{t('cardio.add_details')}</div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <div className="label-caps mb-1 text-fg-subtle">{t('cardio.distance_km')}</div>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                placeholder="0.0"
                value={distance}
                onChange={(e) => setDistance(e.target.value.replace(/[^\d.,]/g, ''))}
                className="w-full rounded-sm text-sm p-2.5 outline-none text-center font-display tabular bg-surface-2 border border-line text-fg focus:border-accent"
              />
            </div>
            <div>
              <div className="label-caps mb-1 text-fg-subtle">{t('cardio.calories')}</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value.replace(/[^\d]/g, ''))}
                className="w-full rounded-sm text-sm p-2.5 outline-none text-center font-display tabular bg-surface-2 border border-line text-fg focus:border-accent"
              />
            </div>
          </div>

          <input
            type="text"
            placeholder={t('cardio.notes_placeholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-sm text-sm p-2.5 outline-none mb-3 bg-surface-2 border border-line text-fg focus:border-accent"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="flex-1 min-h-11 rounded-sm text-sm border border-line text-fg-subtle"
            >
              {t('cardio.discard')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 min-h-11 rounded-sm text-sm font-display font-bold uppercase tracking-[0.08em] bg-accent text-accent-fg transition-transform active:scale-[0.98]"
            >
              {t('cardio.save_session')}
            </button>
          </div>
        </div>
      )}
    </m.div>
  );
}

function WeeklyStats({ sessions }: { sessions: CardioSession[] }) {
  const { t } = useTranslation();
  const now = new Date();
  const weekStart = new Date(now);
  const daysSinceMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
  weekStart.setDate(now.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekSessions = sessions.filter((s) => new Date(s.startedAt) >= weekStart);
  const totalTime = weekSessions.reduce((sum, s) => sum + s.duration, 0);
  const totalDist = weekSessions.reduce((sum, s) => sum + (s.distance ?? 0), 0);
  const totalCals = weekSessions.reduce((sum, s) => sum + (s.calories ?? 0), 0);

  if (weekSessions.length === 0) return null;

  return (
    <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
      <div className="grid grid-cols-3 gap-0 dotted-separator pb-4">
        <div className="flex flex-col gap-1">
          <span className="label-caps text-fg-subtle">{t('cardio.sessions')}</span>
          <span className="text-data font-display font-bold text-fg tabular">
            {weekSessions.length}
          </span>
        </div>
        <div className="flex flex-col gap-1 items-center">
          <span className="label-caps text-fg-subtle">{t('cardio.time')}</span>
          <span className="text-data font-display font-bold text-fg tabular">
            {formatDuration(totalTime)}
          </span>
        </div>
        <div className="flex flex-col gap-1 items-end">
          {totalDist > 0 ? (
            <>
              <span className="label-caps text-fg-subtle">{t('cardio.distance')}</span>
              <span className="text-data font-display font-bold text-fg tabular">
                {totalDist.toFixed(1)}km
              </span>
            </>
          ) : totalCals > 0 ? (
            <>
              <span className="label-caps text-fg-subtle">kcal</span>
              <span className="text-data font-display font-bold text-fg tabular">{totalCals}</span>
            </>
          ) : (
            <>
              <span className="label-caps text-fg-subtle">km</span>
              <span className="text-data font-display font-bold text-fg tabular">—</span>
            </>
          )}
        </div>
      </div>
    </m.div>
  );
}

function SessionHistoryItem({
  session,
  onDelete,
}: {
  session: CardioSession;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex items-center justify-between py-3 dotted-separator">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-accent flex-shrink-0">
          <CardioTypeIcon type={session.type} className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-fg">
            {CARDIO_LABELS[session.type]}
            <span className="ml-2 font-display font-bold tabular text-accent">
              {formatDuration(session.duration)}
            </span>
          </div>
          <div className="text-xs flex items-center gap-2 flex-wrap text-fg-subtle">
            <span>
              {formatDistanceToNow(parseISO(session.startedAt), { addSuffix: true, locale: es })}
            </span>
            {session.distance && <span>· {session.distance}km</span>}
            {session.calories && <span>· {session.calories}kcal</span>}
            {session.avgHr && (
              <span className="flex items-center gap-0.5">
                · <HeartPulse className="w-3 h-3" /> {session.avgHr}
                {session.maxHr ? `/${session.maxHr}` : ''}
              </span>
            )}
            {session.source && session.source !== 'manual' && (
              <span className="label-caps px-1.5 py-0.5 rounded-sm bg-surface-2">
                {t('cardio.health_source')}
              </span>
            )}
          </div>
          {session.notes && (
            <div className="text-xs italic mt-0.5 text-fg-subtle">{session.notes}</div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {confirmDelete ? (
          <m.div
            key="confirm"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex gap-1"
          >
            <button
              type="button"
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
              aria-label={t('common.confirm')}
              className="w-8 h-8 rounded-sm flex items-center justify-center text-xs font-bold bg-error text-accent-fg"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              aria-label={t('common.cancel')}
              className="w-8 h-8 rounded-sm flex items-center justify-center border border-line text-fg-muted"
            >
              ✕
            </button>
          </m.div>
        ) : (
          <m.button
            key="trash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmDelete(true)}
            aria-label={t('common.delete')}
            className="p-2 rounded-sm text-fg-subtle"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </m.button>
        )}
      </AnimatePresence>
    </div>
  );
}

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

      {/* Quick Start: strip de actividades mono estilo Stitch */}
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
                className="flex-shrink-0 w-12 h-12 rounded-sm flex items-center justify-center transition-colors active:scale-95 bg-surface border border-line text-fg-muted hover:text-accent hover:border-line-accent"
              >
                <CardioTypeIcon type={type} className="w-5 h-5" />
              </button>
            ))}
          </div>
        </m.div>
      )}

      {/* History */}
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
