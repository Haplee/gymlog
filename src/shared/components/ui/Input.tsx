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
          className="text-xs font-medium"
          style={{ color: hasError ? 'var(--error)' : 'var(--text-secondary)' }}
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {iconLeft && (
          <span className="absolute left-3.5 text-fg-subtle pointer-events-none">{iconLeft}</span>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          aria-invalid={hasError}
          className={[
            'w-full bg-surface-2 text-fg placeholder:text-fg-subtle',
            'border border-line-strong rounded-xl px-4 py-3.5 text-base',
            'transition-all duration-150',
            'focus:outline-none focus:border-accent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            iconLeft ? 'pl-10' : '',
            iconRight ? 'pr-10' : '',
            hasError ? 'border-error' : '',
            className,
          ].join(' ')}
          {...props}
        />

        {iconRight && <span className="absolute right-3.5 text-fg-subtle">{iconRight}</span>}
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="text-xs text-fg-subtle">
          {helperText}
        </p>
      )}
    </div>
  );
});
