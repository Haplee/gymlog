import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateExerciseLoadType } from '@shared/api/exerciseMutations';
import { LOAD_TYPES, type LoadType } from '@shared/lib/loadType';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { devError } from '@shared/lib/devtools';
import { EquipmentIcon, IconKettlebell } from '@shared/components/icons/EquipmentIcons';
import { IconUser } from '@shared/components/icons';

const CONFIRMED_KEY = 'gymlog-loadtype-confirmed';

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
  equipment,
}: {
  exerciseId: string;
  exerciseName: string;
  loadType: LoadType;
  equipment?: string | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [firstUse, setFirstUse] = useState(() => !readConfirmed().has(exerciseId));

  const mutation = useMutation({
    mutationFn: (next: LoadType) => updateExerciseLoadType(exerciseId, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      queryClient.invalidateQueries({ queryKey: ['exerciseLibrary'] });
    },
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
      {/* Los iconos salen del set propio de la app y no de lucide: `PersonStanding`
          y `Weight` tenían otro grosor de trazo y otra caja, y al lado del icono
          de material (que sí es del set) se veía como un pegote de otra librería.
          Las etiquetas van a dos líneas si hace falta —«Peso corporal» no cabe
          en un tercio de pantalla— en vez de recortarse. */}
      <div className="flex gap-1.5" role="group" aria-label={t('workout.load_type_label')}>
        {LOAD_TYPES.map((value) => {
          const active = value === loadType;
          return (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              aria-pressed={active}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border px-1.5 py-2 text-2xs font-medium leading-tight text-center min-h-11 ${
                active
                  ? 'bg-accent border-accent text-accent-fg'
                  : 'bg-surface border-line text-fg-muted'
              }`}
            >
              {value === 'external' ? (
                <EquipmentIcon equipment={equipment} className="h-4 w-4 flex-shrink-0" />
              ) : value === 'bodyweight' ? (
                <IconUser className="h-4 w-4 flex-shrink-0" />
              ) : (
                <IconKettlebell className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="w-full">{t(`workout.load_type_${value}`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
