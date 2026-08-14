import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { useCardioStore, CARDIO_LABELS } from '@features/cardio/stores/cardioStore';
import { CardioTypeIcon } from '@shared/components/CardioIcons';
import { impact, notificationHaptic, ImpactStyle, NotificationType } from '@shared/lib/haptics';
import { formatSeconds } from '@shared/lib/duration';
import { useVisibilityPausedInterval } from '@shared/hooks/useVisibilityPausedInterval';
import { Pause, Play, Stop } from '@shared/components/icons';

/**
 * Cronómetro gigante con décimas, aislado en su propio componente: el tick de
 * 100 ms solo repinta este nodo de texto, no la pantalla entera. Se detiene
 * en segundo plano vía useVisibilityPausedInterval (batería), y al volver
 * recalcula desde startedAt, así que no se desincroniza.
 */
function RunningClock({ isPaused }: { isPaused: boolean }) {
  const getElapsedMs = useCardioStore((s) => s.getElapsedMs);
  const [tickedMs, setTickedMs] = useState(() => getElapsedMs());

  const tick = useCallback(() => setTickedMs(getElapsedMs()), [getElapsedMs]);
  useVisibilityPausedInterval(tick, 100, !isPaused);

  // En pausa el intervalo se retira sin un último tick, y el estado se quedaría
  // hasta 100 ms por detrás. Leer el store aquí es seguro porque mientras
  // isPaused el valor está congelado por construcción (pausedAt - startedAt).
  const ms = isPaused ? getElapsedMs() : tickedMs;

  const totalSeconds = Math.floor(ms / 1000);
  // Pasada una hora el formato ya es h:mm:ss y las décimas sobran (y no caben).
  const showTenths = totalSeconds < 3600;

  return (
    <div
      className={`mt-1 text-display-huge font-display tabular text-fg ${
        isPaused ? '' : 'timer-pulse'
      }`}
    >
      {formatSeconds(totalSeconds)}
      {showTenths && (
        <span className="text-headline text-accent">.{Math.floor((ms % 1000) / 100)}</span>
      )}
    </div>
  );
}

export function ActiveSessionCard({ userId }: { userId: string | null }) {
  const { t } = useTranslation();
  const isActive = useCardioStore((s) => s.isActive);
  const isPaused = useCardioStore((s) => s.isPaused);
  const activeType = useCardioStore((s) => s.activeType);
  const pauseSession = useCardioStore((s) => s.pauseSession);
  const resumeSession = useCardioStore((s) => s.resumeSession);
  const stopSession = useCardioStore((s) => s.stopSession);
  const discardSession = useCardioStore((s) => s.discardSession);
  const getElapsed = useCardioStore((s) => s.getElapsed);
  const [elapsed, setElapsed] = useState(() => getElapsed());
  const [showFinish, setShowFinish] = useState(false);
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');

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
      className={showFinish ? 'rounded-card p-4 mb-5 bg-surface border border-line' : 'mb-5'}
    >
      {!showFinish ? (
        <>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full bg-accent ${isPaused ? '' : 'pulse-soft'}`}
              aria-hidden="true"
            />
            <span className="label-caps text-accent">
              {isPaused ? t('cardio.paused') : t('cardio.recording')}
            </span>
          </div>

          <RunningClock isPaused={isPaused} />

          <div className="flex gap-3 mt-4">
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
              <Stop className="w-4 h-4" />
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
