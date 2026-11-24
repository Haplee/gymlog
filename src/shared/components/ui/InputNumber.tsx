import { forwardRef } from 'react';

interface InputNumberProps {
  /** Valor actual como string (controlado externamente) */
  value: string;
  /** Callback al cambiar el valor */
  onChange: (value: string) => void;
  /** Callback al perder el foco (para formatear/validar final) */
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /** Etiqueta para accesibilidad (sr-only) */
  label: string;
  /** Paso del stepper (por defecto 1 para reps, 0.5/1/2.5 para peso) */
  step?: number;
  /** Mínimo permitido */
  min?: number;
  /** Máximo permitido */
  max?: number;
  /** Número de decimales permitidos (0 = enteros) */
  decimals?: number;
  /** Clase CSS adicional */
  className?: string;
  /** Deshabilitado */
  disabled?: boolean;
  /** Error de validación (muestra borde rojo) */
  error?: boolean;
}

/**
 * Input numérico compacto con stepper ±, optimizado para filas de serie a 48dp.
 * - KeyboardType="decimal-pad" en móvil
 * - Stepper visual con áreas de toque ≥44×44dp
 * - Formato controlado: decimales limitados, sin notación científica
 * - Accesible: label sr-only, aria-invalid, role=spinbutton
 */
export const InputNumber = forwardRef<HTMLInputElement, InputNumberProps>(function InputNumber(
  {
    value,
    onChange,
    label,
    step = 1,
    min = 0,
    max = 9999,
    decimals = 0,
    className = '',
    disabled = false,
    error = false,
    ...props
  },
  ref,
) {
  const inputId = `input-number-${label.toLowerCase().replace(/\s+/g, '-')}`;

  const handleDecrement = () => {
    if (disabled) return;
    const current = value === '' ? min : parseFloat(value);
    if (Number.isNaN(current)) return;
    const next = Math.max(min, current - step);
    onChange(decimals > 0 ? next.toFixed(decimals) : String(Math.round(next)));
  };

  const handleIncrement = () => {
    if (disabled) return;
    const current = value === '' ? min : parseFloat(value);
    if (Number.isNaN(current)) return;
    const next = Math.min(max, current + step);
    onChange(decimals > 0 ? next.toFixed(decimals) : String(Math.round(next)));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Permitir solo dígitos, punto decimal (si decimals > 0) y signo menos inicial
    let cleaned = raw;
    if (decimals > 0) {
      cleaned = raw.replace(/[^0-9.-]/g, '');
      // Solo un punto decimal
      const parts = cleaned.split('.');
      if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
    } else {
      cleaned = raw.replace(/[^0-9]/g, '');
    }
    onChange(cleaned);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || raw === '.' || raw === '-') {
      onChange('');
      return;
    }
    const num = parseFloat(raw);
    if (Number.isNaN(num)) {
      onChange('');
      return;
    }
    const clamped = Math.max(min, Math.min(max, num));
    onChange(decimals > 0 ? clamped.toFixed(decimals) : String(Math.round(clamped)));
    props.onBlur?.(e);
  };

  return (
    <div className="relative flex items-center gap-1" role="group" aria-label={label}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>

      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled}
        aria-label={`Disminuir ${label}`}
        className={[
          'flex items-center justify-center',
          'w-9 h-9 min-h-[44px] min-w-[44px]', // Touch target 44dp
          'rounded-md',
          'bg-surface-2 border border-line-interactive',
          'text-fg-subtle',
          'active:bg-surface-3',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'transition-colors duration-100',
          'text-lg font-medium',
        ].join(' ')}
      >
        −
      </button>

      <input
        ref={ref}
        id={inputId}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        aria-invalid={error}
        aria-valuemin={min}
        aria-valuemax={max}
        className={[
          'w-16 text-center', // Ancho fijo aprox 64px
          'min-h-[44px]', // Touch target height
          'bg-surface-2 border border-line-interactive rounded-md',
          'text-fg placeholder:text-fg-subtle text-base font-mono tabular-nums',
          'transition-all duration-100',
          'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-error focus:border-error focus:ring-error',
          className,
        ].join(' ')}
        {...props}
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled}
        aria-label={`Aumentar ${label}`}
        className={[
          'flex items-center justify-center',
          'w-9 h-9 min-h-[44px] min-w-[44px]',
          'rounded-md',
          'bg-surface-2 border border-line-interactive',
          'text-fg-subtle',
          'active:bg-surface-3',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'transition-colors duration-100',
          'text-lg font-medium',
        ].join(' ')}
      >
        +
      </button>
    </div>
  );
});

InputNumber.displayName = 'InputNumber';
