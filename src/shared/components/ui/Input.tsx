import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

/**
 * Input con label flotante, helper text, estado error e iconos opcionales.
 *
 * @example
 * <Input
 *   label="Email"
 *   type="email"
 *   error={errors.email}
 *   iconLeft={<MailIcon />}
 * />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, error, iconLeft, iconRight, id, className = '', ...props },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const hasError = Boolean(error);

  return (
    <div className="relative flex flex-col gap-1">
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className={`text-[--text-sm] font-medium transition-colors ${
            hasError ? 'text-[--color-error]' : 'text-[--text-secondary]'
          }`}
        >
          {label}
        </label>
      )}

      {/* Input wrapper */}
      <div className="relative flex items-center">
        {iconLeft && (
          <span className="absolute left-3 text-[--text-muted] pointer-events-none">
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
            'w-full bg-[--bg-surface] text-[--text-primary] placeholder:text-[--text-muted]',
            'border rounded-[--radius-lg] px-3 py-2.5 text-[--text-md]',
            'transition-all duration-[--transition-fast]',
            'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[--bg-base]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            iconLeft ? 'pl-10' : '',
            iconRight ? 'pr-10' : '',
            hasError
              ? 'border-[--color-error] focus:ring-[--color-error]'
              : 'border-[--border-default] focus:border-[--color-primary] focus:ring-[--color-primary]',
            className,
          ].join(' ')}
          {...props}
        />

        {iconRight && <span className="absolute right-3 text-[--text-muted]">{iconRight}</span>}
      </div>

      {/* Error / Helper */}
      {error && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-[--text-xs] text-[--color-error] flex items-center gap-1"
        >
          <span aria-hidden="true">⚠</span> {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="text-[--text-xs] text-[--text-muted]">
          {helperText}
        </p>
      )}
    </div>
  );
});
