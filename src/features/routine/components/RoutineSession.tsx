import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { useRoutineSessionStore } from '@features/routine/stores/routineSessionStore';
import { useWeight } from '@shared/hooks/useWeight';
import { impact, notificationHaptic, ImpactStyle, NotificationType } from '@shared/lib/haptics';
import { celebrate } from '@shared/lib/celebration';
import type { Exercise } from '@shared/lib/types';

interface Props {
  userId: string;
  /** Catálogo cacheado (propios + públicos) para mapear nombre → exercise_id. */
  exercises: Exercise[];
}

export function RoutineSession({ userId, exercises }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { unit: weightUnit, toKg } = useWeight();

  const routineName = useRoutineSessionStore((s) => s.routineName);
  const dayName = useRoutineSessionStore((s) => s.dayName);
  const sessionExercises = useRoutineSessionStore((s) => s.exercises);
  const saving = useRoutineSessionStore((s) => s.saving);
  const { addSet, updateSet, removeSet, discard, finish } = useRoutineSessionStore(
    useShallow((s) => ({
      addSet: s.addSet,
      updateSet: s.updateSet,
      removeSet: s.removeSet,
      discard: s.discard,
      finish: s.finish,
    })),
  );

  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Mapeo por nombre normalizado: la rutina guarda nombres, la BD necesita ids.
  const resolveExerciseId = useCallback(
    (name: string): string | null => {
      const key = name.trim().toLowerCase();
      return exercises.find((e) => e.name.trim().toLowerCase() === key)?.id ?? null;
    },
    [exercises],
  );

  const handleFinish = async () => {
    const result = await finish(userId, resolveExerciseId, toKg);

    if (result.error) {
      void notificationHaptic(NotificationType.Error);
      toast.error(result.error.message);
      return;
    }
    if (!result.success) return;

    // refetchType: 'all' — HistoryPage/StatsPage pueden no estar montadas y el
    // cliente global usa refetchOnMount: false.
    queryClient.invalidateQueries({ queryKey: ['workouts'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['recentSets'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['workoutsAndSets'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['personalRecords'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['lastWorkoutFull'], refetchType: 'all' });

    void notificationHaptic(NotificationType.Success);
    celebrate();
    toast.success(result.queued ? t('routine.session_saved_offline') : t('routine.session_saved'));
    navigate('/history');
  };

  return (
    <div className="rounded-card p-4 bg-surface border border-line-accent shadow-card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="label-caps text-accent">{t('routine.session_in_progress')}</div>
          <div className="text-data font-display font-bold text-fg truncate">{dayName}</div>
          <div className="text-xs text-fg-subtle truncate">{routineName}</div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmDiscard(true)}
          className="flex-shrink-0 min-h-11 label-caps px-3 py-1.5 rounded-sm bg-surface-2 border border-line text-fg-subtle"
        >
          {t('routine.session_discard')}
        </button>
      </div>

      <div className="space-y-4">
        {sessionExercises.map((ex, exIndex) => (
          <div key={ex.name} className="rounded-md p-3 bg-surface-2 border border-line">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <div className="text-base font-medium text-fg truncate">{ex.name}</div>
              {ex.targetSets && (
                <div className="text-2xs text-fg-subtle flex-shrink-0">
                  {t('routine.session_target')} {ex.targetSets} × {ex.targetReps}
                </div>
              )}
            </div>

            <div className="flex gap-1.5 mb-1 text-2xs font-semibold uppercase text-fg-subtle">
              <div className="w-6 flex-shrink-0" />
              <div className="flex-1 text-center">{t('workout.reps')}</div>
              <div className="flex-1 text-center">{weightUnit}</div>
              <div className="w-9 flex-shrink-0" />
            </div>

            <div className="space-y-1.5">
              {ex.sets.map((s, setIndex) => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <div className="w-6 flex-shrink-0 text-xs font-mono tabular-nums text-fg-subtle text-center">
                    {setIndex + 1}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={s.reps}
                    onChange={(e) =>
                      updateSet(exIndex, setIndex, { reps: e.target.value.replace(/[^\d]/g, '') })
                    }
                    aria-label={`${ex.name} — ${t('workout.reps')} ${setIndex + 1}`}
                    className="flex-1 min-h-11 rounded-sm text-sm font-mono tabular-nums px-2 text-center outline-none bg-surface border border-line text-fg focus:border-accent"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={s.weight}
                    onChange={(e) =>
                      updateSet(exIndex, setIndex, {
                        weight: e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'),
                      })
                    }
                    aria-label={`${ex.name} — ${weightUnit} ${setIndex + 1}`}
                    className="flex-1 min-h-11 rounded-sm text-sm font-mono tabular-nums px-2 text-center outline-none bg-surface border border-line text-fg focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => removeSet(exIndex, setIndex)}
                    aria-label={`${t('routine.session_remove_set')} ${setIndex + 1}`}
                    className="w-9 min-h-11 flex-shrink-0 flex items-center justify-center text-fg-subtle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                void impact(ImpactStyle.Light);
                addSet(exIndex);
              }}
              className="mt-2 w-full min-h-11 rounded-sm text-xs border border-dashed border-line-strong text-fg-muted flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('routine.session_add_set')}
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleFinish}
        disabled={saving}
        className="mt-4 w-full min-h-12 rounded-sm text-sm font-display font-bold uppercase tracking-[0.12em] bg-accent text-accent-fg shadow-btn-accent active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        {saving ? t('routine.session_saving') : t('routine.session_finish')}
      </button>

      {confirmDiscard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="rounded-card p-4 w-full max-w-sm bg-surface border border-line">
            <div className="text-sm text-fg mb-4">{t('routine.session_discard_confirm')}</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="flex-1 min-h-11 rounded-sm text-sm bg-surface-2 text-fg-muted"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  discard();
                  setConfirmDiscard(false);
                }}
                className="flex-1 min-h-11 rounded-sm text-sm font-semibold bg-error text-white"
              >
                {t('routine.session_discard')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
