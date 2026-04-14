import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, error, iconLeft, iconRight, id, className = '', ...props },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const hasError = Boolean(error);

  return (
    <div className="relative flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[0.6875rem] font-medium"
          style={{ color: hasError ? 'var(--error)' : 'var(--text-secondary)' }}
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {iconLeft && (
          <span className="absolute left-3.5 text-[var(--text-tertiary)] pointer-events-none">
            {iconLeft}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          aria-invalid={hasError}
          className={[
            'w-full bg-[var(--bg-surface-2)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
            'border border-[var(--border-default)] rounded-[var(--radius-md)] px-4 py-3.5 text-[0.9375rem]',
            'transition-all duration-150',
            'focus:outline-none focus:border-[var(--interactive-primary)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            iconLeft ? 'pl-10' : '',
            iconRight ? 'pr-10' : '',
            hasError ? 'border-[var(--error)]' : '',
            className,
          ].join(' ')}
          {...props}
        />

        {iconRight && (
          <span className="absolute right-3.5 text-[var(--text-tertiary)]">{iconRight}</span>
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-[0.6875rem] text-[var(--error)]">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="text-[0.6875rem] text-[var(--text-tertiary)]">
          {helperText}
        </p>
      )}
    </div>
  );
});
