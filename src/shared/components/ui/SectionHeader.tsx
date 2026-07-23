import { memo } from 'react';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  /** Línea de apoyo bajo el título, como en el kit ("Explore Intermediate Workouts"). */
  subtitle?: string;
  /** Acción a la derecha (icon-button, link…) */
  action?: ReactNode;
  className?: string;
}

/**
 * Cabecera de sección estilo FitBody: titular en negrita (no versalitas) con
 * subtítulo opcional y sin separador punteado.
 * Patrón repetido en Settings, Stats, History, Cardio…
 */
const SectionHeaderComponent = ({
  title,
  subtitle,
  action,
  className = '',
}: SectionHeaderProps) => (
  <div className={`flex items-start justify-between gap-3 mb-3 ${className}`}>
    <div className="min-w-0">
      <h2 className="font-display text-base font-bold text-fg">{title}</h2>
      {subtitle && <p className="text-xs text-fg-subtle mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const SectionHeader = memo(SectionHeaderComponent);
