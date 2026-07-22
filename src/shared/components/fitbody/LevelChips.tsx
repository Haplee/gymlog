import { memo } from 'react';

export interface LevelOption<T extends string> {
  value: T;
  label: string;
}

interface LevelChipsProps<T extends string> {
  options: LevelOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Etiqueta accesible del grupo */
  ariaLabel?: string;
  className?: string;
}

/**
 * Chips de nivel estilo FitBody (Beginner / Intermediate / Advanced): píldoras
 * con el activo relleno de acento. Genérico en el tipo del valor.
 */
function LevelChipsComponent<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: LevelChipsProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={`min-h-9 rounded-pill px-4 label-caps transition-colors duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isActive
                ? 'bg-accent text-accent-fg'
                : 'border border-line bg-surface-2 text-fg-subtle hover:text-fg-muted'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export const LevelChips = memo(LevelChipsComponent) as typeof LevelChipsComponent;
