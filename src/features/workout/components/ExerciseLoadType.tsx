import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dumbbell, PersonStanding, Weight } from 'lucide-react';
import { updateExerciseLoadType } from '@shared/api/exerciseMutations';
import { LOAD_TYPES, type LoadType } from '@shared/lib/loadType';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { devError } from '@shared/lib/devtools';

const CONFIRMED_KEY = 'gymlog-loadtype-confirmed';

const ICONS: Record<LoadType, typeof Dumbbell> = {
  external: Dumbbell,
  bodyweight: PersonStanding,
  bodyweight_loaded: Weight,
};

function readConfirmed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CONFIRMED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function markConfirmed(id: string): void {
  const set = readConfirmed();
  set.add(id);
  try {
    localStorage.setItem(CONFIRMED_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage lleno o no disponible: el prompt reaparecerá, sin más.
  }
}

/**
 * Mini-selector de modalidad de carga del ejercicio activo. La primera vez que
 * se usa un ejercicio se muestra como pregunta destacada; después queda como
 * un selector compacto para cambiarla. Persiste en `exercises.load_type`.
 */
export function ExerciseLoadType({
  exerciseId,
  exerciseName,
  loadType,
}: {
  exerciseId: string;
  exerciseName: string;
  loadType: LoadType;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [firstUse, setFirstUse] = useState(() => !readConfirmed().has(exerciseId));

  const mutation = useMutation({
    mutationFn: (next: LoadType) => updateExerciseLoadType(exerciseId, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercises'] }),
    onError: (e) => devError('[ExerciseLoadType] update failed:', e),
  });

  const choose = (next: LoadType) => {
    void impact(ImpactStyle.Light);
    if (firstUse) {
      markConfirmed(exerciseId);
      setFirstUse(false);
    }
    if (next !== loadType) mutation.mutate(next);
  };

  return (
    <div
      className={`mb-3 rounded-md p-2 ${
        firstUse ? 'border border-accent bg-accent/5' : 'border border-line bg-surface-2'
      }`}
    >
      <div className="text-2xs uppercase font-semibold mb-1.5 text-fg-subtle">
        {firstUse
          ? t('workout.load_type_prompt', { name: exerciseName })
          : t('workout.load_type_label')}
      </div>
      <div className="flex gap-1.5" role="group" aria-label={t('workout.load_type_label')}>
        {LOAD_TYPES.map((value) => {
          const Icon = ICONS[value];
          const active = value === loadType;
          return (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              aria-pressed={active}
              className={`flex-1 min-h-11 px-1.5 rounded-md text-xs font-medium border flex flex-col items-center justify-center gap-0.5 ${
                active
                  ? 'bg-accent border-accent text-accent-fg'
                  : 'bg-surface border-line text-fg-muted'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {t(`workout.load_type_${value}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
