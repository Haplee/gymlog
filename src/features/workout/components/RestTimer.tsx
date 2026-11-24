import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRestTimerStore } from '../stores/restTimerStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import {
  impact,
  ImpactStyle,
  timerDone,
  notificationHaptic,
  NotificationType,
} from '@shared/lib/haptics';
import { playTimerComplete, resumeIfRinging } from '@shared/lib/alarm';
import { useVisibilityPausedInterval } from '@shared/hooks/useVisibilityPausedInterval';
import { m, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Timer, X, Bookmark } from '@shared/components/icons';

const CIRCLE_RADIUS = 44; // 88px diameter
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS; // ~276

export function RestTimer() {
  const { t } = useTranslation();

  const {
    endTime,
    duration,
    isRunning,
    start,
    stop,
    extend,
    remaining,
    alarmRinging,
    dismissAlarm,
    currentExerciseId,
  } = useRestTimerStore(
    useShallow((s) => ({
      endTime: s.endTime,
      duration: s.duration,
      isRunning: s.isRunning,
      start: s.start,
      stop: s.stop,
      extend: s.extend,
      remaining: s.remaining,
      alarmRinging: s.alarmRinging,
      dismissAlarm: s.dismissAlarm,
      currentExerciseId: s.currentExerciseId,
    })),
  );

  const restAutoStart = useSettingsStore((s) => s.restAutoStart);
  const soundEnabled = useSettingsStore((s) => s.sound);
  const setRestDurationForExercise = useSettingsStore((s) => s.setRestDurationForExercise);
  const [display, setDisplay] = useState(() => remaining());
  const [expanded, setExpanded] = useState(false);

  // Refresh countdown every second while running
  const tick = useCallback(() => setDisplay(remaining()), [remaining]);
  useVisibilityPausedInterval(tick, 1000, isRunning && !!endTime);

  // Resume audio alarm if it was ringing and we return to foreground
  useEffect(() => {
    if (alarmRinging) resumeIfRinging();
  }, [alarmRinging]);

  // Play completion sound/haptic when timer reaches 0
  useEffect(() => {
    if (!isRunning && !alarmRinging && endTime !== null && display <= 0) {
      void timerDone();
      if (soundEnabled) playTimerComplete();
    }
  }, [display, isRunning, alarmRinging, endTime, soundEnabled]);

  const shown = !isRunning || !endTime ? 0 : display;
  const mins = Math.floor(shown / 60);
  const secs = shown % 60;
  const progress = duration > 0 ? 1 - Math.max(0, shown / duration) : 0; // 0→1 (circle fills up)
  const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - progress);
  const urgent = shown <= 10 && shown > 0;

  const handleStart = useCallback(
    (seconds: number) => {
      start(seconds);
      setExpanded(false);
      void impact(ImpactStyle.Heavy);
    },
    [start],
  );

  const handleExtend = useCallback(
    (seconds: number) => {
      extend(seconds);
      void impact(ImpactStyle.Light);
    },
    [extend],
  );

  const handleStop = useCallback(() => {
    stop();
    setExpanded(false);
    void impact(ImpactStyle.Medium);
  }, [stop]);

  const handleDismissAlarm = useCallback(() => {
    dismissAlarm();
    void notificationHaptic(NotificationType.Success);
  }, [dismissAlarm]);

  // Alarm ringing: full-screen overlay
  if (alarmRinging) {
    return (
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-canvas/95 backdrop-blur-sm p-4"
        role="alert"
        aria-live="assertive"
      >
        <Timer className="h-16 w-16 text-accent animate-pulse" />
        <h2 className="font-display text-2xl font-bold text-fg text-center">
          {t('workout.rest_complete')}
        </h2>
        <button
          type="button"
          onClick={handleDismissAlarm}
          className="min-h-[56px] min-w-[56px] rounded-full bg-accent text-accent-fg font-bold text-lg shadow-glow active:scale-95"
          aria-label={t('common.dismiss')}
        >
          {t('common.dismiss')}
        </button>
      </m.div>
    );
  }

  // Timer running: sticky bottom bar with circular progress
  if (isRunning && endTime) {
    return (
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed left-0 right-0 z-40 pb-2"
        style={{
          bottom:
            'calc(var(--bottom-nav-height) + var(--inset-bottom, env(safe-area-inset-bottom)))',
        }}
        role="timer"
        aria-label={t('workout.rest_timer_running')}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={shown}
      >
        <div className="mx-auto max-w-[360px] glass-3 rounded-xl border border-glass-edge p-3 shadow-lg">
          {/* Circular progress + time */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={`${t('workout.rest_remaining')}: ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
            className="relative flex flex-col items-center gap-2 w-full"
          >
            <div className="relative w-20 h-20" aria-hidden="true">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background track */}
                <circle
                  cx="50"
                  cy="50"
                  r={CIRCLE_RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-surface-3"
                />
                {/* Progress ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={CIRCLE_RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={CIRCLE_CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  className={`transition-all duration-300 ease-linear ${
                    urgent ? 'text-error' : 'text-accent'
                  }`}
                  style={{ strokeDashoffset }}
                />
              </svg>
              <span
                className={`absolute inset-0 flex items-center justify-center font-display font-bold tabular text-xl ${
                  urgent ? 'text-error' : 'text-fg'
                }`}
              >
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
            </div>

            {/* Expandable controls */}
            <AnimatePresence>
              {expanded && (
                <m.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full overflow-hidden"
                >
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleExtend(30)}
                      className="flex-1 min-h-11 rounded-pill bg-accent px-3 text-sm font-bold text-accent-fg active:scale-95"
                    >
                      +30s
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStart(duration)}
                      aria-label={t('workout.rest_restart')}
                      className="tap-44 flex h-11 w-11 items-center justify-center rounded-pill bg-surface-2 text-fg-muted"
                    >
                      <Timer className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleStop}
                      aria-label={t('common.close')}
                      className="tap-44 flex h-11 w-11 items-center justify-center rounded-pill text-fg-subtle"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    {/* Guardar como descanso predeterminado para este ejercicio */}
                    {currentExerciseId && (
                      <button
                        type="button"
                        onClick={() => {
                          setRestDurationForExercise(currentExerciseId, duration);
                          void impact(ImpactStyle.Light);
                        }}
                        aria-label={t('workout.rest_save_as_default')}
                        className="tap-44 flex h-11 w-11 items-center justify-center rounded-pill bg-surface-2 text-fg-muted active:bg-surface-3 transition-colors"
                      >
                        <Bookmark className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </button>

          {/* Quick adjust ±30s without expanding */}
          <div className="mt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleExtend(-30)}
              disabled={shown <= 30}
              className="tap-44 flex h-9 w-9 items-center justify-center rounded-pill bg-surface-2 text-fg-subtle disabled:opacity-40 disabled:cursor-not-allowed active:bg-surface-3"
              aria-label={t('workout.rest_adjust_minus', { seconds: 30 })}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="label-caps text-xs text-fg-subtle w-20 text-center">
              {t('workout.rest_adjust_label')}
            </span>
            <button
              type="button"
              onClick={() => handleExtend(30)}
              className="tap-44 flex h-9 w-9 items-center justify-center rounded-pill bg-surface-2 text-fg-subtle active:bg-surface-3"
              aria-label={t('workout.rest_adjust_plus', { seconds: 30 })}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </m.div>
    );
  }

  // Timer not running: compact inline picker (shown in WorkoutPage when idle)
  return (
    <div className="rounded-lg p-3 bg-surface border border-line shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold uppercase flex items-center gap-1.5 tracking-widest text-fg-subtle">
          <Timer className="w-3.5 h-3.5" />
          {t('workout.rest')}
        </div>
        <button
          type="button"
          onClick={() => {
            useSettingsStore.getState().setRestAutoStart(!restAutoStart);
            void impact(ImpactStyle.Light);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-2xs font-bold uppercase tracking-wider transition-colors border ${
            restAutoStart
              ? 'bg-accent/10 text-accent border-line-accent'
              : 'bg-surface-2 text-fg-subtle border-line'
          }`}
          aria-pressed={restAutoStart}
          title={t(restAutoStart ? 'workout.rest_auto_on' : 'workout.rest_auto_off')}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${restAutoStart ? 'bg-accent' : 'bg-fg-subtle'}`}
          />
          {t(restAutoStart ? 'workout.rest_auto_on' : 'workout.rest_auto_off')}
        </button>
      </div>

      <div className="space-y-3">
        {/* Presets */}
        <div className="grid grid-cols-4 gap-1.5">
          {[60, 90, 120, 180].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStart(s)}
              className={`py-2.5 rounded-pill text-sm font-bold transition-all active:scale-95 ${
                s === duration
                  ? 'bg-accent text-accent-fg shadow-glow'
                  : 'bg-surface-2 text-fg-muted border border-line'
              }`}
            >
              {`${s}s`}
            </button>
          ))}
        </div>

        {/* Custom duration with steppers */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleStart(Math.max(10, duration - 15))}
            className="tap-44 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-surface-2 text-fg-muted active:bg-surface-3"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleStart(duration)}
            className={`flex-1 h-9 rounded-pill text-sm font-bold transition-all active:scale-95 ${'bg-accent text-accent-fg shadow-glow'}`}
          >
            {`${duration}s`}
          </button>
          <button
            type="button"
            onClick={() => handleStart(Math.min(600, duration + 15))}
            className="tap-44 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-surface-2 text-fg-muted active:bg-surface-3"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
