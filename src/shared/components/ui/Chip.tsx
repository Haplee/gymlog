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
 * Chip angular estilo Stitch. `filter` = píldora angular de filtro
 * (librería, wearables); `day` = cuadrado compacto (selector L-D de rutinas).
 * Activo: borde + texto acento, sin relleno (look Stitch).
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
      className={`inline-flex label-caps rounded-sm border transition-colors duration-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${base} ${
        selected
          ? 'border-accent text-accent bg-accent/10'
          : 'border-line-strong text-fg-subtle hover:text-fg-muted hover:border-line-strong'
      } ${className}`}
    >
      {children}
    </button>
  );
};

export const Chip = memo(ChipComponent);
