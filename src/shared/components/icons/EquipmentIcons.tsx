/**
 * Iconos de equipamiento con la forma real de cada implemento (no genéricos).
 * Mismo criterio que `GymIcons.tsx`: rejilla 24×24, silueta rellena,
 * `currentColor`. Se añaden aquí porque lucide-react no tiene barra olímpica,
 * banda elástica ni kettlebell con esa forma.
 */
import { memo } from 'react';
import { Dumbbell, PersonStanding } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { IconDumbbell } from './GymIcons';

export interface GymIconProps {
  className?: string;
}

const svgProps = (className = '') =>
  ({
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    'aria-hidden': true,
    focusable: false,
  }) as const;

/** Barra olímpica: bar larga con discos pequeños en los extremos (a diferencia de la mancuerna, que tiene barra corta y discos grandes). */
export const IconBarbell = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <rect x="0.6" y="7.5" width="2.6" height="9" rx="1" />
    <rect x="3.6" y="9.4" width="1.6" height="5.2" rx="0.8" />
    <rect x="5.2" y="11" width="13.6" height="2" rx="1" />
    <rect x="18.8" y="9.4" width="1.6" height="5.2" rx="0.8" />
    <rect x="20.8" y="7.5" width="2.6" height="9" rx="1" />
  </svg>
));
IconBarbell.displayName = 'IconBarbell';

/** Torre de máquina de poleas: stack de discos con guía vertical. */
export const IconMachine = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <rect x="11" y="1" width="2" height="21" rx="1" />
    <rect x="4" y="3" width="16" height="3.2" rx="1" />
    <rect x="4" y="7.4" width="16" height="3.2" rx="1" />
    <rect x="4" y="11.8" width="16" height="3.2" rx="1" />
    <rect x="4" y="16.2" width="16" height="3.2" rx="1" />
  </svg>
));
IconMachine.displayName = 'IconMachine';

/** Polea de cable: rodillo, cable y agarre. */
export const IconPulley = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <circle cx="12" cy="5" r="3.4" />
    <rect x="11" y="8.2" width="2" height="8" rx="1" />
    <rect x="6" y="17" width="12" height="3" rx="1.5" />
  </svg>
));
IconPulley.displayName = 'IconPulley';

/** Banda elástica: anillo grueso. */
export const IconBand = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2.4c-5.52 0-9.6 4.48-9.6 9.6s4.08 9.6 9.6 9.6 9.6-4.48 9.6-9.6-4.08-9.6-9.6-9.6zm0 3.2a6.4 6.4 0 1 1 0 12.8 6.4 6.4 0 0 1 0-12.8z"
    />
  </svg>
));
IconBand.displayName = 'IconBand';

/** Kettlebell: bola con asa en arco. */
export const IconKettlebell = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path d="M7.6 8.4a4.4 4.4 0 0 1 8.8 0v1.3h-2.4V8.4a2 2 0 0 0-4 0v1.3H7.6z" />
    <circle cx="12" cy="15.5" r="7.3" />
  </svg>
));
IconKettlebell.displayName = 'IconKettlebell';

const EQUIPMENT_ICONS: Record<string, LucideIcon | typeof IconDumbbell> = {
  Barra: IconBarbell,
  Mancuernas: IconDumbbell,
  Máquina: IconMachine,
  Polea: IconPulley,
  'Peso corporal': PersonStanding,
  Bandas: IconBand,
  Kettlebell: IconKettlebell,
  Otro: Dumbbell,
};

/** Icono con la forma real del equipo indicado en `exercises.equipment`. */
export function EquipmentIcon({
  equipment,
  className,
}: {
  equipment?: string | null;
  className?: string;
}) {
  const Icon = (equipment && EQUIPMENT_ICONS[equipment]) || Dumbbell;
  return <Icon className={className} aria-hidden="true" />;
}
