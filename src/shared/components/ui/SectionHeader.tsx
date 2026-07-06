import { memo } from 'react';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  /** Acción a la derecha (icon-button, link…) */
  action?: ReactNode;
  className?: string;
}

/**
 * Cabecera de sección estilo Stitch: título caps + separador punteado.
 * Patrón repetido en Settings, Stats, History, Cardio…
 */
const SectionHeaderComponent = ({ title, action, className = '' }: SectionHeaderProps) => (
  <div className={`dotted-separator flex items-end justify-between pb-2 mb-3 ${className}`}>
    <h2 className="label-caps text-fg-subtle">{title}</h2>
    {action}
  </div>
);

export const SectionHeader = memo(SectionHeaderComponent);
