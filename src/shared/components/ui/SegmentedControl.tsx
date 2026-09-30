import { memo } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

type SegmentedSize = 'sm' | 'md';

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Etiqueta accesible del grupo */
  ariaLabel?: string;
  /**
   * `sm` (36px) para un selector que compite con otros en la misma fila;
   * `md` (44px) para el resto, que es el suelo táctil de CLAUDE.md. Por
   * defecto `sm` para no cambiar la geometría de los selectores ya medidos.
   */
  size?: SegmentedSize;
  className?: string;
}

/**
 * Control segmentado: contenedor en píldora sobre bg-surface-2,
 * segmento activo relleno de acento con texto on-primary.
 *
 * Mismo criterio que en `Chip`: sin `label-caps`. Aquí el texto es lo que el
 * usuario tiene que leer para saber en qué modo está (KG / LB, y lo que sea),
 * y la versalita de 11px lo deja ilegible justo en el control que más se mira.
 * Se reserva `label-caps` para eyebrows de marca.
 */
function SegmentedControlComponent<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'sm',
  className = '',
}: SegmentedControlProps<T>) {
  const segmentSize = size === 'md' ? 'min-h-11' : 'min-h-9';
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 p-1 bg-surface-2 rounded-pill ${className}`}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={`flex-1 ${segmentSize} px-3 rounded-pill text-sm font-semibold transition-[background-color,color,opacity] duration-100 cursor-pointer active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isActive ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-fg'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export const SegmentedControl = memo(SegmentedControlComponent) as typeof SegmentedControlComponent;
