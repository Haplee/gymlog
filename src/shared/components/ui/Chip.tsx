import { memo } from 'react';
import type { ReactNode } from 'react';

type ChipVariant = 'filter' | 'day';

interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  variant?: ChipVariant;
  disabled?: boolean;
  className?: string;
}

/**
 * Chip estilo FitBody. `filter` = píldora (librería, wearables); `day` =
 * círculo compacto (selector L-D de rutinas).
 * En el kit los chips van siempre rellenos: el activo con el acento y el
 * inactivo con una superficie clara - nunca en contorno.
 *
 * Sin `label-caps`, a diferencia de otros rótulos de la app: aquí el texto es
 * un filtro que se lee y se toca, no un eyebrow de marca. A 11px en versalita
 * con 0.1em de tracking, «PECHO» y «ESPALDA» dejan de distinguirse a un vistazo
 * y encima se ensanchan (`letter-spacing` cuenta para el ancho) hasta que la
 * píldora crece por lo que ocupa la letra. El estado activo lo marca el relleno
 * de acento y el peso, que es lo que hace falta.
 */
const ChipComponent = ({
  children,
  selected = false,
  onClick,
  variant = 'filter',
  disabled = false,
  className = '',
}: ChipProps) => {
  const base =
    variant === 'day'
      ? 'w-11 h-11 shrink-0 items-center justify-center text-sm'
      : 'min-h-9 px-3.5 items-center gap-1.5 text-sm';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`inline-flex font-semibold rounded-pill transition-[background-color,color,transform] duration-100 cursor-pointer active:scale-95 disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${base} ${
        selected ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:text-fg'
      } ${className}`}
    >
      {children}
    </button>
  );
};

export const Chip = memo(ChipComponent);
