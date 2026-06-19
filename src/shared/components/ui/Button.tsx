import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { memo } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg font-semibold shadow-btn-accent active:scale-[0.97]',
  secondary: 'bg-surface-2 text-fg active:scale-[0.97]',
  ghost: 'bg-transparent text-fg-muted hover:bg-hover',
  danger: 'bg-error text-accent-fg active:scale-[0.97]',
  icon: 'bg-transparent text-fg-subtle hover:bg-hover aspect-square',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-pill',
  md: 'h-11 px-5 text-base rounded-pill',
  lg: 'h-12 px-6 text-base rounded-pill',
};

const ButtonComponent = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-2 cursor-pointer font-medium',
        'transition-all duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base',
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
};

export const Button = memo(ButtonComponent);

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
