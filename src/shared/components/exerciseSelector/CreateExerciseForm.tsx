import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui';
import { MuscleGroupIcon } from '@shared/components/CardioIcons';
import { MUSCLE_GROUPS, suggestMuscleGroup } from '@shared/constants/muscleGroups';
import { muscleGroupLabel } from '@shared/lib/muscleGroupLabel';
import { MuscleGroupPills } from './MuscleGroupPills';
import { AlertCircle, Check, Loader, Minus, Plus } from '@shared/components/icons';

interface CreateExerciseFormProps {
  name: string;
  onNameChange: (value: string) => void;
  muscle: string;
  onMuscleChange: (mg: string) => void;
  secondaries: Record<string, number>;
  onToggleSecondary: (mg: string) => void;
  onAdjustSecondary: (mg: string, delta: number) => void;
  isBodyweight: boolean;
  onToggleBodyweight: () => void;
  error: string | null;
  isPending: boolean;
  onCancel: () => void;
  onCreate: () => void;
}

export function CreateExerciseForm({
  name,
  onNameChange,
  muscle,
  onMuscleChange,
  secondaries,
  onToggleSecondary,
  onAdjustSecondary,
  isBodyweight,
  onToggleBodyweight,
  error,
  isPending,
  onCancel,
  onCreate,
}: CreateExerciseFormProps) {
  const { t } = useTranslation();
  return (
    <div className="p-3 border-t border-line">
      <div className="text-xs font-semibold uppercase tracking-wider mb-2 text-fg-subtle">
        {t('workout.new_exercise')}
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => {
          const v = e.target.value;
          onNameChange(v);
          const suggested = suggestMuscleGroup(v);
          if (suggested) onMuscleChange(suggested);
        }}
        placeholder={t('workout.exercise_name_placeholder')}
        className="w-full px-3 py-2 rounded-md text-sm outline-none bg-surface-2 border border-line-strong text-fg"
        autoFocus
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <MuscleGroupPills active={muscle} onSelect={onMuscleChange} />
      </div>

      {/* Secundarios ponderados (opcional) */}
      <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
        {t('workout.secondary_muscles')}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {MUSCLE_GROUPS.filter((mg) => mg !== muscle).map((mg) => {
          const active = mg in secondaries;
          const etiqueta = muscleGroupLabel(mg, t);
          return (
            <div key={mg} className="flex items-center">
              <button
                type="button"
                onClick={() => onToggleSecondary(mg)}
                aria-pressed={active}
                className={`flex items-center gap-1 px-2.5 min-h-9 text-xs rounded-sm border transition-colors ${
                  active
                    ? 'bg-accent/15 text-accent border-accent'
                    : 'bg-surface-2 text-fg-muted border-line'
                }`}
              >
                <MuscleGroupIcon name={mg} className="w-3 h-3" />
                {etiqueta}
                {active && <span className="tabular-nums">· {secondaries[mg]}%</span>}
              </button>
              {active && (
                <span className="flex items-center ml-1">
                  <button
                    type="button"
                    onClick={() => onAdjustSecondary(mg, -10)}
                    aria-label={`${etiqueta} -10%`}
                    className="flex h-11 w-11 items-center justify-center rounded-sm bg-surface-2 text-fg-muted"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdjustSecondary(mg, 10)}
                    aria-label={`${etiqueta} +10%`}
                    className="ml-0.5 flex h-11 w-11 items-center justify-center rounded-sm bg-surface-2 text-fg-muted"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Peso corporal */}
      <button
        type="button"
        onClick={onToggleBodyweight}
        aria-pressed={isBodyweight}
        className={`mt-3 flex items-center gap-2 px-3 min-h-11 w-full rounded-md border text-sm transition-colors ${
          isBodyweight
            ? 'bg-accent/15 text-accent border-accent'
            : 'bg-surface-2 text-fg-muted border-line'
        }`}
      >
        <Check className={`w-4 h-4 ${isBodyweight ? 'opacity-100' : 'opacity-30'}`} />
        {t('workout.bodyweight_exercise')}
      </button>

      {error && (
        <div className="flex items-center gap-1 mt-2 text-xs text-error">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <Button variant="ghost" size="sm" onClick={onCancel} className="flex-1">
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onCreate}
          disabled={isPending || !name.trim()}
          className="flex-1"
        >
          {isPending ? <Loader className="w-4 h-4 animate-spin" /> : t('common.create')}
        </Button>
      </div>
    </div>
  );
}
