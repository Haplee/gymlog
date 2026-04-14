import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-[--color-primary] text-[--text-inverse] font-semibold hover:brightness-110 active:scale-95 shadow-[--shadow-glow]',
  secondary:
    'bg-[--bg-elevated] text-[--text-primary] border border-[--border-default] hover:border-[--color-primary] hover:text-[--color-primary]',
  ghost:
    'bg-transparent text-[--text-secondary] hover:bg-[--bg-elevated] hover:text-[--text-primary]',
  danger:
    'bg-[--color-error-subtle] text-[--color-error] border border-[--color-error]/30 hover:bg-[--color-error] hover:text-white',
  icon: 'bg-transparent text-[--text-secondary] hover:bg-[--bg-elevated] hover:text-[--color-primary] aspect-square',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-8 px-3 text-[--text-sm] rounded-[--radius-md]',
  md: 'h-10 px-4 text-[--text-md] rounded-[--radius-lg]',
  lg: 'h-12 px-6 text-[--text-lg] rounded-[--radius-xl]',
};

/**
 * Botón reutilizable con variantes, tamaños y estado loading.
 *
 * @example
 * <Button variant="primary" size="md" loading={isSaving}>
 *   Guardar
 * </Button>
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-2 cursor-pointer',
        'transition-all duration-[--transition-fast]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg-base]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        variantStyles[variant],
        sizeStyles[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <>
          <Spinner size={size} />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner({ size }: { size: Size }) {
  const dim = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <svg
      className={`${dim} animate-spin`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
