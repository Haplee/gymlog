import { useId } from 'react';

interface RulerPickerProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Unidad que se pinta pequeña junto al número (cm, kg…). */
  unit: string;
  label: string;
  onChange: (value: number) => void;
}

/** Marcas de la regla; una de cada cinco es larga, como en el kit. */
const TICKS = Array.from({ length: 41 }, (_, i) => i);

/**
 * Selector de medida estilo FitBody: número grande arriba y una regla debajo
 * con la marca del acento en la posición actual.
 *
 * El gesto lo maneja un `input[type=range]` real puesto encima a opacidad 0:
 * así el control conserva su semántica y su manejo por teclado, y la regla es
 * solo la representación visual.
 */
export function RulerPicker({
  value,
  min,
  max,
  step = 1,
  unit,
  label,
  onChange,
}: RulerPickerProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-fg-muted">
        {label}
      </label>

      <div className="mt-1 text-center">
        <span className="font-display text-3xl font-bold tabular text-fg">{value}</span>
        <span className="ml-1 text-sm text-fg-subtle">{unit}</span>
      </div>

      <div className="relative mt-2 h-12">
        <div className="absolute inset-x-0 top-0 flex h-8 items-end justify-between">
          {TICKS.map((i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`w-px bg-line-strong ${i % 5 === 0 ? 'h-6' : 'h-3'}`}
            />
          ))}
        </div>
        <div
          aria-hidden="true"
          className="absolute top-0 h-8 w-1 -translate-x-1/2 rounded-pill bg-accent"
          style={{ left: `${pct}%` }}
        />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}
