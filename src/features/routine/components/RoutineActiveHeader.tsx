import { useTranslation } from 'react-i18next';
import type { Routine } from '@features/routine/stores/routineStore';
import { Printer, Share } from '@shared/components/icons';

interface RoutineActiveHeaderProps {
  routine: Routine;
  onShare: () => void;
  onPrint: () => void;
  onClickChange: () => void;
}

/**
 * Cabecera de la rutina activa: nombre, descripción y las acciones sobre el
 * plan completo.
 *
 * `items-start` y no `items-center`: con una descripción de cuatro líneas,
 * «Cambiar» quedaba flotando a media altura del párrafo en vez de emparejado
 * con el nombre de la rutina, que es a lo que se refiere. `min-w-0` para que un
 * nombre largo trunque en vez de empujar al botón fuera.
 */
export function RoutineActiveHeader({
  routine,
  onShare,
  onPrint,
  onClickChange,
}: RoutineActiveHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <div className="text-data font-display font-bold text-fg">{routine.name}</div>
        <div className="text-xs text-fg-subtle">{routine.description}</div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        {/* Compartir manda solo el plan: ni entrenamientos, ni pesos, ni
            pesajes. Imprimir saca la misma rutina en una hoja con casillas
            para apuntar a boli. */}
        <button
          type="button"
          onClick={onShare}
          aria-label={t('routine.share')}
          title={t('routine.share')}
          className="min-h-11 min-w-11 grid place-items-center rounded-pill bg-surface-2 text-fg-muted active:scale-[0.98] transition-transform"
        >
          <Share className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onPrint}
          aria-label={t('routine.print')}
          title={t('routine.print')}
          className="min-h-11 min-w-11 grid place-items-center rounded-pill bg-surface-2 text-fg-muted active:scale-[0.98] transition-transform"
        >
          <Printer className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={onClickChange}
        className="label-caps min-h-11 flex-shrink-0 px-3 py-1.5 rounded-pill bg-surface-2 text-fg-muted"
      >
        {t('routine.change')}
      </button>
    </div>
  );
}
