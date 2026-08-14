import { memo } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Etiqueta accesible cuando no hay label visible asociado */
  ariaLabel?: string;
}

/**
 * Switch: pista en píldora, thumb circular. Área táctil ≥44px vía padding
 * invisible.
 *
 * Era angular (`rounded-sm` en pista y thumb) por la etapa Stitch. Un switch
 * cuadrado se lee como casilla, no como interruptor: lo que dice "esto se
 * desliza" es la forma redonda del thumb dentro de una pista redonda.
 */
const ToggleComponent = ({ checked, onChange, disabled = false, ariaLabel }: ToggleProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="relative inline-flex items-center justify-center p-2 -m-2 min-w-11 min-h-11 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none group"
  >
    <span
      className={`relative w-11 h-6 rounded-pill transition-colors duration-150 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-canvas ${
        checked ? 'bg-accent-dim' : 'bg-surface-3'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-150 ${
          checked ? 'translate-x-5 bg-accent-fg' : 'translate-x-0 bg-fg-subtle'
        }`}
      />
    </span>
  </button>
);

export const Toggle = memo(ToggleComponent);
