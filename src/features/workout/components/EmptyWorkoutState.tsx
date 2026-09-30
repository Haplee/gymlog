import { useTranslation } from 'react-i18next';
import type { WorkoutWithSets } from '@shared/lib/types';
import { Plus, Repeat } from '@shared/components/icons';

interface EmptyWorkoutStateProps {
  onAddSet: () => void;
  lastWorkout: WorkoutWithSets | undefined;
  onRepeatLast: () => void;
}

/**
 * Lo que ofrece el inicio cuando todavía no hay nada registrado.
 *
 * Tres revisiones, y las tres quitaron caja:
 *
 * 1. Era una isla: un círculo de 64 px con un «+», dos líneas de texto y dos
 *    píldoras centradas en el 42 % del alto. Se leía como la ilustración de un
 *    estado vacío, no como la lista de lo que puedes hacer.
 * 2. Luego fue un rótulo de sección y dos filas. El rótulo no lo pedía nadie:
 *    las listas de la app no se presentan, y con dos elementos metía una
 *    línea más entre el buscador y lo que ofrece. Las dos filas tampoco
 *    coincidían entre sí —una con borde y fondo, la otra sin nada— y esa
 *    asimetría se leía como descuido.
 * 3. Ahora son dos filas lisas separadas por un filete. Sin rótulo, sin bordes,
 *    sin fondos, sin iconos en recuadro. El dato de apoyo va en la segunda
 *    línea, que es donde ya se esperaba encontrarlo, y el acento no aparece
 *    porque la acción principal —el buscador de arriba— ya lo lleva.
 */
export function EmptyWorkoutState({ onAddSet, lastWorkout, onRepeatLast }: EmptyWorkoutStateProps) {
  const { t } = useTranslation();
  const canRepeat = !!lastWorkout && lastWorkout.sets.length > 0;

  return (
    // `divide-y` en vez de un gap con bordes: un separador es un separador, y
    // con `gap` había que dibujar la línea a mano en una de las dos filas.
    // `pb-8` deja que el aire caiga al final, que es donde el vacío se lee como
    // margen y no como falta; antes el bloque iba centrado en el 42 % del alto
    // y ese hueco quedaba en medio, diciendo «esto es todo lo que hay».
    <div className="flex flex-col divide-y divide-line pb-8">
      {canRepeat && (
        <button
          type="button"
          onClick={onRepeatLast}
          className="flex min-h-11 w-full items-center gap-3 py-2.5 text-left transition-opacity active:opacity-60"
        >
          <Repeat className="h-4 w-4 flex-shrink-0 text-fg-subtle" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-fg">{t('workout.repeat_last')}</span>
            <span className="mt-0.5 block truncate text-xs text-fg-subtle">{lastWorkout.name}</span>
          </span>
        </button>
      )}

      {/* El camino manual. Sin fondo, sin borde y sin acento porque es la salida
          para cuando el ejercicio no está en la biblioteca, no la vía normal. */}
      <button
        type="button"
        onClick={onAddSet}
        className="flex min-h-11 w-full items-center gap-3 py-2.5 text-left transition-opacity active:opacity-60"
      >
        <Plus className="h-4 w-4 flex-shrink-0 text-fg-subtle" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-fg-muted">{t('workout.add_set')}</span>
          <span className="mt-0.5 block truncate text-xs text-fg-subtle">
            {t('workout.add_set_hint')}
          </span>
        </span>
      </button>
    </div>
  );
}
