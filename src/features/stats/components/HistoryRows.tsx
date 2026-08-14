import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkoutWithSets, WorkoutSetWithDetails } from '@shared/lib/types';
import { ChevronRight, Star, Trash2 } from '@shared/components/icons';

export function ExerciseRow({
  exercise,
  sets,
  onDelete,
}: {
  exercise: string;
  sets: WorkoutSetWithDetails[];
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const sortedSets = [...sets].sort((a, b) => a.set_num - b.set_num);
  const firstSet = sortedSets[0];

  return (
    <div className="last:border-b-0 border-b border-line">
      <div
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        className="px-3 py-3 flex justify-between items-center cursor-pointer transition-colors hover:bg-hover active:bg-hover"
      >
        <div className="flex items-center gap-3">
          <ChevronRight
            className="w-4 h-4 flex-shrink-0 transition-transform"
            style={{
              color: 'var(--text-tertiary)',
              transform: expanded ? 'rotate(90deg)' : 'none',
            }}
          />
          <span className="text-base font-medium text-fg">{exercise}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Pill de dato del kit (su "Duration · 25 Mins"): relleno, no contorno. */}
          <span className="text-2xs px-2.5 py-1 rounded-pill font-bold font-mono tabular-nums bg-accent text-accent-fg">
            {sortedSets.length} {t('history.series_plural')}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(firstSet.id);
            }}
            className="p-1.5 rounded-card transition-colors text-fg-subtle hover:bg-error/10 active:bg-error/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {sortedSets.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-1 px-3 py-2 rounded-md ml-7 bg-surface-2 border border-line"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-fg-subtle">
                    {t('workout.sets')} {s.set_num}
                  </span>
                  <span className="text-sm text-fg-muted">
                    {s.reps} {t('workout.reps').toLowerCase()}
                  </span>
                  {s.is_warmup && (
                    <span className="text-2xs px-1.5 py-0.5 rounded-sm font-bold uppercase bg-warning/15 text-warning">
                      W
                    </span>
                  )}
                  {typeof s.rpe === 'number' && (
                    <span className="text-2xs px-1.5 py-0.5 rounded-sm font-bold bg-surface-3 text-fg-muted">
                      RPE {s.rpe}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums font-semibold text-sm text-accent">
                    {s.weight} {t('stats.kg_unit')}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    className="p-1 rounded text-fg-subtle"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {s.notes && <div className="text-xs italic pl-1 text-fg-subtle">“{s.notes}”</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkoutMeta({ workout }: { workout: WorkoutWithSets }) {
  const rating = workout.rating ?? null;
  const notes = workout.notes?.trim();
  if (!rating && !notes) return null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      {rating ? (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`w-3.5 h-3.5 ${n <= rating ? 'fill-accent text-accent' : 'text-fg-subtle'}`}
              aria-hidden="true"
            />
          ))}
        </div>
      ) : null}
      {notes ? <div className="text-xs italic text-fg-subtle">“{notes}”</div> : null}
    </div>
  );
}
