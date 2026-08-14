type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-3 text-fg-muted',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  error: 'bg-error/15 text-error',
  info: 'bg-info/15 text-info',
};

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const sizeStyles = size === 'sm' ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-pill font-medium ${sizeStyles} ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
