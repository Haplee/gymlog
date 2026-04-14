type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'pr';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  /** Dot indicador sin texto */
  dot?: boolean;
}

const variantMap: Record<BadgeVariant, string> = {
  default: 'bg-[--bg-elevated] text-[--text-secondary] border-[--border-default]',
  primary: 'bg-[--color-primary-subtle] text-[--color-primary] border-[--color-primary-border]',
  success: 'bg-[--color-success-subtle] text-[--color-success] border-[--color-success]/30',
  warning: 'bg-[--color-warning-subtle] text-[--color-warning] border-[--color-warning]/30',
  danger: 'bg-[--color-error-subtle] text-[--color-error] border-[--color-error]/30',
  info: 'bg-[--color-info-subtle] text-[--color-info] border-[--color-info]/30',
  pr: 'bg-[--color-primary] text-[--text-inverse] border-transparent shadow-[--shadow-glow]',
};

/**
 * Badge para músculo, equipamiento, récord personal, etc.
 *
 * @example
 * <Badge variant="primary">Pecho</Badge>
 * <Badge variant="pr">¡Nuevo PR! 🏆</Badge>
 */
export function Badge({ children, variant = 'default', size = 'sm', dot = false }: BadgeProps) {
  const sizeStyles = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[--text-xs] px-2.5 py-1';

  if (dot) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 ${sizeStyles} rounded-[--radius-full] border font-medium ${variantMap[variant]}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {children}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-[--radius-full] border font-medium ${sizeStyles} ${variantMap[variant]}`}
    >
      {children}
    </span>
  );
}
