import { memo } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Etiqueta accesible del grupo */
  ariaLabel?: string;
  className?: string;
}

/**
 * Control segmentado: contenedor en píldora sobre bg-surface-2,
 * segmento activo relleno de acento con texto on-primary.
 */
function SegmentedControlComponent<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: SegmentedControlProps<T>) {
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
            className={`min-h-9 px-4 rounded-pill label-caps transition-colors duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isActive ? 'bg-accent text-accent-fg font-semibold' : 'text-fg-subtle hover:text-fg'
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
