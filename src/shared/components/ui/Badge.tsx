type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--bg-surface-3)] text-[var(--text-secondary)]',
  success: 'bg-[#30D15820] text-[var(--success)]',
  warning: 'bg-[#FFD60A20] text-[var(--warning)]',
  error: 'bg-[#FF453A20] text-[var(--error)]',
  info: 'bg-[#0A84FF20] text-[var(--info)]',
};

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const sizeStyles =
    size === 'sm' ? 'text-[0.6875rem] px-2.5 py-1' : 'text-[0.8125rem] px-3 py-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-pill)] font-medium ${sizeStyles} ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
