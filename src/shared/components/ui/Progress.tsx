interface ProgressProps {
  /** Valor actual, dentro de [0, max]. */
  value: number;
  /** Techo de la escala. 100 por defecto (porcentajes y scores 0-100). */
  max?: number;
  /** Nombre accesible de la barra: qué mide, no el número. */
  label: string;
  /** Texto alternativo del valor si el número solo no basta (p. ej. "1 h 12 min"). */
  valueText?: string;
  className?: string;
}

/**
 * Barra de progreso accesible. El track y el relleno salen de tokens, no de
 * colores sueltos, para que el modo claro y los reskins no la dejen invisible.
 */
export function Progress({ value, max = 100, label, valueText, className }: ProgressProps) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(safeMax, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <progress
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuetext={valueText}
      value={clamped}
      max={safeMax}
      className={`w-full h-2 appearance-none ${className ?? ''}`}
    />
  );
}
