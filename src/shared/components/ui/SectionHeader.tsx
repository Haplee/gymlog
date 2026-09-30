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
 * Cabecera de sección: titular en negrita con subtítulo opcional y sin
 * separador punteado. Patrón repetido en Settings, Stats, History, Cardio.
 *
 * El rótulo va en `text-fg`, no en acento, a diferencia de otros rótulos de la
 * app. En el kit de marca los rótulos de sección ("Activities", "Round 1") van
 * en color de acento, y aquí eso se disparaba: cinco secciones por pantalla
 * significaban cinco manchas de acento, y con el acento repartido ya no señalaba
 * «esto es lo importante» sino que era textura. Un acento, una acción
 * principal por pantalla. Si la sección trae una acción, esa acción es la que
 * lleva el acento, y por eso va en `action` y no en el titular.
 */
const SectionHeaderComponent = ({
  title,
  subtitle,
  action,
  className = '',
}: SectionHeaderProps) => (
  <div className={`flex items-start justify-between gap-3 mb-4 ${className}`}>
    <div className="min-w-0">
      <h2 className="font-display text-lg font-bold text-fg">{title}</h2>
      {subtitle && <p className="text-sm text-fg-subtle mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const SectionHeader = memo(SectionHeaderComponent);
