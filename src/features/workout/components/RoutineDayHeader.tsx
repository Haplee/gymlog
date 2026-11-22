import { m, type Variants } from 'framer-motion';
import type { RoutineExercise } from '@features/routine/stores/routineStore';
import { LoadTypeBadge } from '@shared/components/LoadTypeBadge';
import { formatSegundos } from '@features/routine/utils/planTarget';
import { planModeOf } from '@features/routine/utils/planTarget';

interface RoutineDayHeaderProps {
  name: string;
  weekdayName: string;
  isIdle: boolean;
  exercises: RoutineExercise[];
  variants: Variants;
}

export function RoutineDayHeader({
  name,
  weekdayName,
  isIdle,
  exercises,
  variants,
}: RoutineDayHeaderProps) {
  return (
    <m.div
      variants={variants}
      initial="hidden"
      animate="show"
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mb-4"
    >
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">
        {name} · <span className="capitalize">{weekdayName}</span>
      </h1>
      {isIdle && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {exercises.slice(0, 4).map((ex) => (
            <span
              key={ex.name}
              className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg-muted flex items-center gap-1.5"
            >
              {ex.name}
              {ex.load_type && ex.load_type !== 'external' && (
                <LoadTypeBadge loadType={ex.load_type} className="!py-0.5 !px-1.5 !text-[10px]" />
              )}
              {planModeOf(ex) === 'time' && ex.durationSeconds && (
                <span className="label-caps px-1.5 py-0.5 rounded-sm bg-surface-3 text-fg-muted text-[10px]">
                  {formatSegundos(ex.durationSeconds)}
                </span>
              )}
              {ex.perSide && (
                <span className="label-caps px-1.5 py-0.5 rounded-sm bg-surface-3 text-fg-muted text-[10px]">
                  ½
                </span>
              )}
              {ex.targetWeight != null && ex.targetWeight > 0 && ex.load_type !== 'external' && (
                <span className="label-caps px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
                  {ex.load_type === 'bodyweight_loaded'
                    ? `${ex.targetWeight} kg`
                    : ex.load_type === 'band_resistance'
                      ? `${ex.targetWeight} kg`
                      : `${ex.targetWeight} kg`}
                </span>
              )}
            </span>
          ))}
          {exercises.length > 4 && (
            <span className="px-1 py-1 text-xs text-fg-subtle">+{exercises.length - 4}</span>
          )}
        </div>
      )}
    </m.div>
  );
}
