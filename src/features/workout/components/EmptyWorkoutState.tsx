import { useTranslation } from 'react-i18next';
import type { WorkoutWithSets } from '@shared/lib/types';
import { Plus, Repeat } from '@shared/components/icons';

interface EmptyWorkoutStateProps {
  onAddSet: () => void;
  lastWorkout: WorkoutWithSets | undefined;
  onRepeatLast: () => void;
}

export function EmptyWorkoutState({ onAddSet, lastWorkout, onRepeatLast }: EmptyWorkoutStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-2 gap-4">
      <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center">
        <Plus className="w-7 h-7 text-accent" aria-hidden="true" />
      </div>
      <div>
        <div className="text-base font-semibold text-fg">{t('workout.empty_sets')}</div>
        <div className="text-sm text-fg-subtle mt-1">{t('workout.empty_hint')}</div>
      </div>
      <div className="flex flex-col items-stretch gap-2 w-full max-w-[16rem]">
        <button
          type="button"
          onClick={onAddSet}
          className="w-full py-3 rounded-pill bg-accent text-accent-fg font-semibold shadow-btn-accent active:scale-[0.98]"
        >
          {t('workout.add_set')}
        </button>
        {lastWorkout && lastWorkout.sets.length > 0 && (
          <button
            type="button"
            onClick={onRepeatLast}
            className="w-full py-3 rounded-pill bg-surface-2 border border-line text-fg-muted flex items-center justify-center gap-1.5 transition-colors active:bg-hover"
          >
            <Repeat className="w-4 h-4" />
            {t('workout.repeat_last')}
          </button>
        )}
      </div>
    </div>
  );
}
