import { memo } from 'react';
import type { ReactNode } from 'react';
import { cardClass, type CardVariant } from './cardStyles';
import { SectionHeader } from './SectionHeader';

interface CardProps {
  /** Papel del bloque. Ver el porqué de cada uno en `cardStyles.ts`. */
  variant?: CardVariant;
  /** Titular de la sección. Delega en `SectionHeader` para no duplicar criterio. */
  title?: string;
  subtitle?: string;
  /** Acción a la derecha del titular. Es el único sitio que gasta acento. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Bloque de contenido con un papel declarado: caja, banda o foco.
 *
 * El titular es opcional a propósito. La mayoría de bandas y tarjetas ya llevan
 * su rótulo fuera, y meterlo dentro solo para envolverlo sería ruido.
 */
const CardComponent = ({
  variant = 'surface',
  title,
  subtitle,
  action,
  className = '',
  children,
}: CardProps) => (
  <div className={cardClass(variant, className)}>
    {title && <SectionHeader title={title} subtitle={subtitle} action={action} />}
    {children}
  </div>
);

export const Card = memo(CardComponent);
