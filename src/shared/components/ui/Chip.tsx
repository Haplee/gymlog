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
 * inactivo con una superficie clara — nunca en contorno.
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
      ? 'w-11 h-11 shrink-0 items-center justify-center'
      : 'min-h-9 px-3 items-center gap-1.5';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`inline-flex label-caps rounded-pill transition-[background-color,color,transform] duration-100 cursor-pointer active:scale-95 disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${base} ${
        selected
          ? 'bg-accent text-accent-fg font-semibold'
          : 'bg-surface-2 text-fg-muted hover:text-fg'
      } ${className}`}
    >
      {children}
    </button>
  );
};

export const Chip = memo(ChipComponent);
