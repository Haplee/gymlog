import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Play, Pause, Square, Trash2, Timer, TrendingUp, Calendar } from 'lucide-react';

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

const CARDIO_COLORS: Record<CardioType, string> = {
  running: '#fb923c',
  cycling: '#38bdf8',
  walking: '#a3e635',
  rowing: '#a78bfa',
  swimming: '#22d3ee',
  elliptical: '#f472b6',
  jump_rope: '#facc15',
  other: '#94a3b8',
};

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
      className="rounded-2xl p-4 mb-3 bg-surface border-2 border-accent shadow-glow"
    >
      {!showFinish ? (
        <>
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full bg-accent shadow-glow ${isPaused ? '' : 'pulse-soft'}`}
                  aria-hidden="true"
                />
                <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-fg-subtle">
                  {label} · {isPaused ? 'En pausa' : 'En curso'}
                </span>
              </div>
              {activeType && (
                <span className="text-accent">
                  <CardioTypeIcon type={activeType} className="w-5 h-5" />
                </span>
              )}
            </div>
            <div
              className={`mt-1.5 font-mono font-bold tabular-nums leading-none tracking-tight text-fg text-[2.75rem] ${
                isPaused ? '' : 'timer-pulse'
              }`}
            >
              {formatSeconds(elapsed)}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (isPaused) resumeSession();
                else pauseSession();
                void impact(ImpactStyle.Light);
              }}
              className="flex-1 py-2.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-medium bg-surface-2 text-fg-muted"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? 'Continuar' : 'Pausar'}
            </button>
            <button
              onClick={handleStop}
              className="flex-1 py-2.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold bg-accent text-accent-fg transition-transform active:scale-[0.98]"
            >
              <Square className="w-4 h-4" />
              Terminar
            </button>
          </div>
        </>
      ) : (
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold mb-1 text-fg">
            {activeType && <CardioTypeIcon type={activeType} className="w-4 h-4" />}
            {label} · {formatSeconds(elapsed)}
          </div>
          <div className="text-xs mb-3 text-fg-subtle">Añade detalles opcionales</div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <div className="text-xs mb-1 text-fg-subtle">Distancia (km)</div>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                placeholder="0.0"
                value={distance}
                onChange={(e) => setDistance(e.target.value.replace(/[^\d.,]/g, ''))}
                className="w-full rounded-lg text-sm p-2 outline-none text-center bg-surface-2 border border-line text-fg"
              />
            </div>
            <div>
              <div className="text-xs mb-1 text-fg-subtle">Calorías</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value.replace(/[^\d]/g, ''))}
                className="w-full rounded-lg text-sm p-2 outline-none text-center bg-surface-2 border border-line text-fg"
              />
            </div>
          </div>

          <input
            type="text"
            placeholder="Notas (opcional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg text-sm p-2 outline-none mb-3 bg-surface-2 border border-line text-fg"
          />

          <div className="flex gap-2">
            <button
              onClick={handleDiscard}
              className="flex-1 py-2 rounded-2xl text-sm border border-line text-fg-subtle"
            >
              Descartar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2 rounded-2xl text-sm font-semibold bg-accent text-accent-fg transition-transform active:scale-[0.98]"
            >
              Guardar sesión
            </button>
          </div>
        </div>
      )}
    </m.div>
  );
}

function WeeklyStats({ sessions }: { sessions: CardioSession[] }) {
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
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 mb-3 bg-surface border border-line shadow-card"
    >
      <div className="text-xs font-semibold uppercase mb-3 flex items-center gap-1.5 text-fg-subtle">
        <TrendingUp className="w-3.5 h-3.5" />
        Esta semana
      </div>
      <div className="grid grid-cols-3 gap-0">
        <div className="flex flex-col items-center py-1">
          <span className="text-lg font-bold font-mono text-fg tabular-nums">
            {weekSessions.length}
          </span>
          <span className="text-2xs uppercase text-fg-subtle">Sesiones</span>
        </div>
        <div className="flex flex-col items-center py-1 border-x border-line">
          <span className="text-lg font-bold font-mono text-fg tabular-nums">
            {formatDuration(totalTime)}
          </span>
          <span className="text-2xs uppercase text-fg-subtle">Tiempo</span>
        </div>
        <div className="flex flex-col items-center py-1">
          {totalDist > 0 ? (
            <>
              <span className="text-lg font-bold font-mono text-fg tabular-nums">
                {totalDist.toFixed(1)}km
              </span>
              <span className="text-2xs uppercase text-fg-subtle">Distancia</span>
            </>
          ) : totalCals > 0 ? (
            <>
              <span className="text-lg font-bold font-mono text-fg tabular-nums">{totalCals}</span>
              <span className="text-2xs uppercase text-fg-subtle">kcal</span>
            </>
          ) : (
            <>
              <span className="text-lg font-bold font-mono text-fg tabular-nums">—</span>
              <span className="text-2xs uppercase text-fg-subtle">km</span>
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0 border-line">
      <div className="flex items-center gap-3">
        <span className="text-accent">
          <CardioTypeIcon type={session.type} className="w-5 h-5" />
        </span>
        <div>
          <div className="text-sm font-medium text-fg">
            {CARDIO_LABELS[session.type]}
            <span className="ml-2 font-mono font-semibold text-accent">
              {formatDuration(session.duration)}
            </span>
          </div>
          <div className="text-xs flex items-center gap-2 text-fg-subtle">
            <span>
              {formatDistanceToNow(parseISO(session.startedAt), { addSuffix: true, locale: es })}
            </span>
            {session.distance && <span>· {session.distance}km</span>}
            {session.calories && <span>· {session.calories}kcal</span>}
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
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: 'var(--error)', color: '#fff' }}
            >
              ✓
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center border"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
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
            className="p-1.5 rounded-lg text-fg-subtle"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </m.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CardioPage() {
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
      <h1 className="text-xl font-extrabold mb-4 text-accent text-balance">Cardio</h1>
      <ActiveSessionCard userId={user?.id ?? null} />

      {/* Quick Start */}
      {!isActive && (
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 mb-3 bg-surface border border-line shadow-card"
        >
          <div className="text-xs font-semibold uppercase mb-3 flex items-center gap-1.5 text-fg-subtle">
            <Timer className="w-3.5 h-3.5" />
            Iniciar sesión
          </div>
          <div className="grid grid-cols-4 gap-2">
            {CARDIO_TYPES.map((type) => {
              const color = CARDIO_COLORS[type];
              return (
                <button
                  key={type}
                  onClick={() => handleStart(type)}
                  className="relative flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95 overflow-hidden bg-surface-2 border border-line"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ backgroundColor: color, opacity: 0.7 }}
                  />
                  <span style={{ color }}>
                    <CardioTypeIcon type={type} className="w-6 h-6" />
                  </span>
                  <span className="text-2xs font-medium leading-tight text-center text-fg-muted">
                    {CARDIO_LABELS[type]}
                  </span>
                </button>
              );
            })}
          </div>
        </m.div>
      )}

      {/* Weekly Stats */}
      <WeeklyStats sessions={sessions} />

      {/* History */}
      {sessions.length > 0 && (
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 bg-surface border border-line shadow-card"
        >
          <div className="text-xs font-semibold uppercase mb-2 flex items-center gap-1.5 text-fg-subtle">
            <Calendar className="w-3.5 h-3.5" />
            Historial
          </div>
          {sessions.slice(0, 20).map((session) => (
            <SessionHistoryItem
              key={session.id}
              session={session}
              onDelete={() => void deleteSession(session.id, user?.id ?? null)}
            />
          ))}
        </m.div>
      )}

      {sessions.length === 0 && !isActive && (
        <div className="text-center py-12 text-sm text-fg-subtle">
          Inicia tu primera sesión de cardio
        </div>
      )}
    </Layout>
  );
}
