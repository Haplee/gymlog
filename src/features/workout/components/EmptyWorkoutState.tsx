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
 * Antes esto era una isla: un círculo de 64 px con un «+», dos líneas de texto
 * y dos píldoras centradas en el 42 % del alto de la ventana. Se leía como la
 * ilustración de un estado vacío —«aquí no hay nada»— y no como una lista de lo
 * que puedes hacer a continuación. El hueco del medio era el protagonista.
 *
 * Ahora el buscador de arriba ya es la acción principal y lleva el acento, así
 * que este bloque baja el volumen a propósito: un rótulo de sección y dos
 * filas con su dato de apoyo al lado. La primera acción ya no compite con la
 * que está por encima de ella.
 */
export function EmptyWorkoutState({ onAddSet, lastWorkout, onRepeatLast }: EmptyWorkoutStateProps) {
  const { t } = useTranslation();
  const canRepeat = !!lastWorkout && lastWorkout.sets.length > 0;

  return (
    // Sin `min-h` en vh ni centrado vertical. El bloque va anclado arriba, con
    // aire por debajo, porque el contenido se lee de arriba abajo y una isla
    // centrada en la pantalla dice «esto es todo lo que hay» justo cuando lo
    // que quiere el usuario es bajar a entrenar. El hueco queda al final, que
    // es donde el vacío se lee como margen y no como falta.
    <section aria-labelledby="empty-alt" className="flex flex-col gap-2 pb-8">
      <h2 id="empty-alt" className="label-caps px-1 pb-1 text-fg-subtle">
        {t('workout.start_another_way')}
      </h2>

      {canRepeat && (
        <button
          type="button"
          onClick={onRepeatLast}
          className="flex min-h-11 w-full items-center gap-3 rounded-card border border-line bg-surface-2 px-3 py-2 text-left transition-colors active:bg-hover"
        >
          <Repeat className="h-4 w-4 flex-shrink-0 text-fg-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-fg">{t('workout.repeat_last')}</span>
            <span className="mt-0.5 block truncate text-xs text-fg-subtle">{lastWorkout.name}</span>
          </span>
        </button>
      )}

      {/* El camino manual. Va sin acento y sin fondo a propósito: es la salida
          para cuando el ejercicio no está en la biblioteca, no la vía normal,
          y con la píldora de acento de antes competía de igual a igual con el
          buscador de arriba. */}
      <button
        type="button"
        onClick={onAddSet}
        className="flex min-h-11 w-full items-center gap-3 rounded-card px-3 py-2 text-left transition-colors active:bg-hover"
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-2 border border-line">
          <Plus className="h-4 w-4 text-fg-muted" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-fg-muted">{t('workout.add_set')}</span>
          <span className="mt-0.5 block truncate text-xs text-fg-subtle">
            {t('workout.add_set_hint')}
          </span>
        </span>
      </button>
    </section>
  );
}
