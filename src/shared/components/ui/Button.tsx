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
    'bg-[var(--interactive-primary)] text-[var(--interactive-primary-fg)] font-semibold active:scale-[0.97]',
  secondary: 'bg-[var(--bg-surface-2)] text-[var(--text-primary)] active:scale-[0.97]',
  ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]',
  danger: 'bg-[var(--error)] text-[var(--interactive-primary-fg)] active:scale-[0.97]',
  icon: 'bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--interactive-hover)] aspect-square',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-9 px-3 text-[0.8125rem] rounded-[var(--radius-pill)]',
  md: 'h-11 px-5 text-[0.9375rem] rounded-[var(--radius-pill)]',
  lg: 'h-12 px-6 text-[0.9375rem] rounded-[var(--radius-pill)]',
};

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
        'inline-flex items-center justify-center gap-2 cursor-pointer font-medium',
        'transition-all duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--interactive-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]',
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
