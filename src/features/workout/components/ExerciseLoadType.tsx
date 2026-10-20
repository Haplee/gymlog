import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateExerciseLoadType } from '@shared/api/exerciseMutations';
import { LOAD_TYPES, type LoadType } from '@shared/lib/loadType';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { devError } from '@shared/lib/devtools';
import { EquipmentIcon } from '@shared/components/icons/EquipmentIcons';
// Los dos de Reicon, y los mismos que ya usa `LoadTypeBadge` para estos
// conceptos en las listas: antes el selector dibujaba `IconUser` donde el badge
// dibuja `Man`, y `IconKettlebell` donde el badge dibuja `Backpack`. El mismo
// tipo de carga se veía distinto según la pantalla, y encima la kettlebell
// mentía: el lastre no es una kettlebell. La kettlebell propia sigue existiendo
// para el equipamiento que sí lo es — Reicon no la trae con esa forma, ni
// tampoco máquina, polea o banda.
import { Backpack, Man } from '@shared/components/icons';

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
 * se usa un ejercicio se muestra como pregunta destacada; después **se pliega a
 * un chip** que dice la modalidad vigente y se abre al tocarlo. Persiste en
 * `exercises.load_type`.
 *
 * Lo de plegarlo es de la pasada de UX: es un ajuste que se decide una vez por
 * ejercicio y ocupaba tres botones fijos por encima de las series, en la
 * pantalla que más se abre y justo donde hay que teclear. La pregunta sigue
 * saliendo entera la primera vez, que es cuando hay algo que decidir.
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
  /** Selector desplegado. Ya confirmado, se abre solo si el usuario lo pide. */
  const [open, setOpen] = useState(false);

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
    setOpen(false);
  };

  const desplegado = firstUse || open;

  // Ya contestado y sin desplegar: una línea que dice qué modalidad está puesta
  // y se abre al tocarla.
  if (!desplegado) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="label-caps mb-3 flex min-h-11 items-center gap-2 rounded-sm bg-surface-2 px-3 text-fg-muted transition-colors active:bg-hover"
      >
        {loadType === 'external' ? (
          <EquipmentIcon equipment={equipment} className="h-4 w-4 flex-shrink-0" />
        ) : loadType === 'bodyweight' ? (
          <Man className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
        ) : (
          <Backpack className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
        )}
        {t(`workout.load_type_${loadType}`)}
      </button>
    );
  }

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
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border px-1.5 py-2 text-2xs font-medium leading-tight text-center min-h-11 transition-transform active:scale-95 ${
                active
                  ? 'bg-accent border-accent text-accent-fg'
                  : 'bg-surface border-line text-fg-muted'
              }`}
            >
              {value === 'external' ? (
                <EquipmentIcon equipment={equipment} className="h-4 w-4 flex-shrink-0" />
              ) : value === 'bodyweight' ? (
                <Man className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              ) : (
                <Backpack className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              )}
              <span className="w-full">{t(`workout.load_type_${value}`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
