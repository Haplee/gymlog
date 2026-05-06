import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

function ActiveSessionCard() {
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

  const handleSave = () => {
    stopSession({
      distance: distance ? parseFloat(distance) : undefined,
      calories: calories ? parseInt(calories) : undefined,
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
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[var(--radius-lg)] p-4 mb-3"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '2px solid var(--interactive-primary)',
      }}
    >
      {!showFinish ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {activeType && (
                <span style={{ color: 'var(--interactive-primary)' }}>
                  <CardioTypeIcon type={activeType} className="w-5 h-5" />
                </span>
              )}
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {label}
                </div>
                <div className="text-[0.6875rem]" style={{ color: 'var(--text-tertiary)' }}>
                  {isPaused ? 'En pausa' : 'En curso'}
                </div>
              </div>
            </div>
            <div
              className="font-mono text-2xl font-bold tabular-nums"
              style={{ color: 'var(--interactive-primary)' }}
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
              className="flex-1 py-2.5 rounded-[var(--radius-lg)] flex items-center justify-center gap-2 text-sm font-medium"
              style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? 'Continuar' : 'Pausar'}
            </button>
            <button
              onClick={handleStop}
              className="flex-1 py-2.5 rounded-[var(--radius-lg)] flex items-center justify-center gap-2 text-sm font-semibold"
              style={{
                backgroundColor: 'var(--interactive-primary)',
                color: 'var(--interactive-primary-fg)',
              }}
            >
              <Square className="w-4 h-4" />
              Terminar
            </button>
          </div>
        </>
      ) : (
        <div>
          <div
            className="flex items-center gap-2 text-sm font-semibold mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            {activeType && <CardioTypeIcon type={activeType} className="w-4 h-4" />}
            {label} · {formatSeconds(elapsed)}
          </div>
          <div className="text-[0.6875rem] mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Añade detalles opcionales
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <div className="text-[0.6875rem] mb-1" style={{ color: 'var(--text-tertiary)' }}>
                Distancia (km)
              </div>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.0"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="w-full rounded-lg text-sm p-2 outline-none text-center"
                style={{
                  backgroundColor: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <div className="text-[0.6875rem] mb-1" style={{ color: 'var(--text-tertiary)' }}>
                Calorías
              </div>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full rounded-lg text-sm p-2 outline-none text-center"
                style={{
                  backgroundColor: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <input
            type="text"
            placeholder="Notas (opcional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg text-sm p-2 outline-none mb-3"
            style={{
              backgroundColor: 'var(--bg-surface-2)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          />

          <div className="flex gap-2">
            <button
              onClick={handleDiscard}
              className="flex-1 py-2 rounded-[var(--radius-lg)] text-sm border"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}
            >
              Descartar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2 rounded-[var(--radius-lg)] text-sm font-semibold"
              style={{
                backgroundColor: 'var(--interactive-primary)',
                color: 'var(--interactive-primary-fg)',
              }}
            >
              Guardar sesión
            </button>
          </div>
        </div>
      )}
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[var(--radius-lg)] p-4 mb-3"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="text-[0.75rem] font-semibold uppercase mb-3 flex items-center gap-1.5"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <TrendingUp className="w-3.5 h-3.5" />
        Esta semana
      </div>
      <div className="grid grid-cols-3 gap-0">
        <div className="flex flex-col items-center py-1">
          <span className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
            {weekSessions.length}
          </span>
          <span className="text-[0.6rem] uppercase" style={{ color: 'var(--text-tertiary)' }}>
            Sesiones
          </span>
        </div>
        <div
          className="flex flex-col items-center py-1 border-x"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <span className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
            {formatDuration(totalTime)}
          </span>
          <span className="text-[0.6rem] uppercase" style={{ color: 'var(--text-tertiary)' }}>
            Tiempo
          </span>
        </div>
        <div className="flex flex-col items-center py-1">
          {totalDist > 0 ? (
            <>
              <span
                className="text-lg font-bold font-mono"
                style={{ color: 'var(--text-primary)' }}
              >
                {totalDist.toFixed(1)}km
              </span>
              <span className="text-[0.6rem] uppercase" style={{ color: 'var(--text-tertiary)' }}>
                Distancia
              </span>
            </>
          ) : totalCals > 0 ? (
            <>
              <span
                className="text-lg font-bold font-mono"
                style={{ color: 'var(--text-primary)' }}
              >
                {totalCals}
              </span>
              <span className="text-[0.6rem] uppercase" style={{ color: 'var(--text-tertiary)' }}>
                kcal
              </span>
            </>
          ) : (
            <>
              <span
                className="text-lg font-bold font-mono"
                style={{ color: 'var(--text-primary)' }}
              >
                —
              </span>
              <span className="text-[0.6rem] uppercase" style={{ color: 'var(--text-tertiary)' }}>
                km
              </span>
            </>
          )}
        </div>
      </div>
    </motion.div>
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
    <div
      className="flex items-center justify-between py-3 border-b last:border-b-0"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center gap-3">
        <span style={{ color: 'var(--interactive-primary)' }}>
          <CardioTypeIcon type={session.type} className="w-5 h-5" />
        </span>
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {CARDIO_LABELS[session.type]}
            <span
              className="ml-2 font-mono font-semibold"
              style={{ color: 'var(--interactive-primary)' }}
            >
              {formatDuration(session.duration)}
            </span>
          </div>
          <div
            className="text-[0.6875rem] flex items-center gap-2"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <span>
              {formatDistanceToNow(parseISO(session.startedAt), { addSuffix: true, locale: es })}
            </span>
            {session.distance && <span>· {session.distance}km</span>}
            {session.calories && <span>· {session.calories}kcal</span>}
          </div>
          {session.notes && (
            <div
              className="text-[0.6875rem] italic mt-0.5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {session.notes}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {confirmDelete ? (
          <motion.div
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
          </motion.div>
        ) : (
          <motion.button
            key="trash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CardioPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isActive, startSession, sessions, deleteSession } = useCardioStore();

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

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
      <ActiveSessionCard />

      {/* Quick Start */}
      {!isActive && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[var(--radius-lg)] p-4 mb-3"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="text-[0.75rem] font-semibold uppercase mb-3 flex items-center gap-1.5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Timer className="w-3.5 h-3.5" />
            Iniciar sesión
          </div>
          <div className="grid grid-cols-4 gap-2">
            {CARDIO_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => handleStart(type)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-[var(--radius-lg)] transition-all active:scale-95"
                style={{
                  backgroundColor: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>
                  <CardioTypeIcon type={type} className="w-5 h-5" />
                </span>
                <span
                  className="text-[0.625rem] font-medium leading-tight text-center"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {CARDIO_LABELS[type]}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Weekly Stats */}
      <WeeklyStats sessions={sessions} />

      {/* History */}
      {sessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[var(--radius-lg)] p-4"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="text-[0.75rem] font-semibold uppercase mb-2 flex items-center gap-1.5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Calendar className="w-3.5 h-3.5" />
            Historial
          </div>
          {sessions.slice(0, 20).map((session) => (
            <SessionHistoryItem
              key={session.id}
              session={session}
              onDelete={() => deleteSession(session.id)}
            />
          ))}
        </motion.div>
      )}

      {sessions.length === 0 && !isActive && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Inicia tu primera sesión de cardio
        </div>
      )}
    </Layout>
  );
}
