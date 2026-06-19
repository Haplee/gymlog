import type { CardioType } from '@features/cardio/stores/cardioStore';

interface IconProps {
  className?: string;
}

/* ────────────────────────────  CARDIO  ────────────────────────────
   Misma "dinámica" que los iconos de músculos (ver MUSCLE_SVG abajo):
   duotono — contexto tenue (máquina/suelo/agua) en trazo fino con
   strokeOpacity 0.3, y el SUJETO activo (figura o pieza clave) resaltado:
   cabeza/zonas rellenas en currentColor (fillOpacity ~0.55) y miembros en
   trazo grueso. Da profundidad y unifica el set con los músculos. */

const CARDIO_SVG = {
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeWidth: 1.1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// Miembros del sujeto activo: trazo grueso = se lee como "relleno".
const LIMB = { strokeWidth: 2.2 } as const;
// Cabeza/zonas rellenas del sujeto.
const FILL = {
  fill: 'currentColor' as const,
  fillOpacity: 0.6,
  stroke: 'none' as const,
} as const;
// Contexto (entorno/máquina): tenue.
const FAINT = { strokeOpacity: 0.3 } as const;

function TreadmillIcon({ className }: IconProps) {
  // Corredor resaltado sobre cinta tenue
  return (
    <svg viewBox="0 0 24 24" className={className} {...CARDIO_SVG}>
      {/* cinta + consola (contexto tenue) */}
      <path d="M3 18.5h11l4 2.5H6.2z" {...FAINT} />
      <path d="M14 18.5V10" {...FAINT} />
      <rect x="12.4" y="6.6" width="4" height="3" rx="0.5" {...FAINT} />
      {/* corredor resaltado */}
      <circle cx="9" cy="4.3" r="1.7" {...FILL} />
      <path d="M9 6.3l-0.5 4" {...LIMB} />
      <path d="M8.8 7.1l2.7 1.5" {...LIMB} />
      <path d="M8.8 7.1L6.1 8.8" {...LIMB} />
      <path d="M8.5 10.3l2.4 3.4" {...LIMB} />
      <path d="M8.5 10.3L5.7 13.3" {...LIMB} />
    </svg>
  );
}

function BikeIcon({ className }: IconProps) {
  // Bici tenue + ciclista resaltado
  return (
    <svg viewBox="0 0 24 24" className={className} {...CARDIO_SVG}>
      {/* bici (contexto tenue) */}
      <circle cx="5.5" cy="17.5" r="3.2" {...FAINT} />
      <circle cx="18.5" cy="17.5" r="3.2" {...FAINT} />
      <path d="M5.5 17.5l4-6h5M9.5 11.5l4 6" {...FAINT} />
      <path d="M13.5 7.5h2.5" {...FAINT} />
      {/* ciclista resaltado */}
      <circle cx="11.5" cy="4.3" r="1.6" {...FILL} />
      <path d="M11.5 6l1.5 3.5" {...LIMB} />
      <path d="M11.6 6.6l2.4-0.1" {...LIMB} />
      <path d="M13 9.5l-3.5 2" {...LIMB} />
    </svg>
  );
}

function WalkingIcon({ className }: IconProps) {
  // Figura caminando resaltada sobre suelo tenue
  return (
    <svg viewBox="0 0 24 24" className={className} {...CARDIO_SVG}>
      <path d="M5 21h14" {...FAINT} />
      <circle cx="12.5" cy="3.6" r="1.7" {...FILL} />
      <path d="M12.5 5.5l-0.8 5.2" {...LIMB} />
      <path d="M12.4 6.6l2.7 1.8" {...LIMB} />
      <path d="M12.1 7L9.4 8.9" {...LIMB} />
      <path d="M11.7 10.7l1.7 4.7 0 4.2" {...LIMB} />
      <path d="M11.7 10.7l-2.6 4 -1 4.6" {...LIMB} />
    </svg>
  );
}

function RowingMachineIcon({ className }: IconProps) {
  // Remero resaltado sobre máquina tenue
  return (
    <svg viewBox="0 0 24 24" className={className} {...CARDIO_SVG}>
      {/* máquina (contexto tenue) */}
      <circle cx="4.3" cy="14" r="2.4" {...FAINT} />
      <path d="M6.5 14.5h13" {...FAINT} />
      <path d="M3 18h2M18 18h2" {...FAINT} />
      {/* remero resaltado */}
      <circle cx="14" cy="6.6" r="1.6" {...FILL} />
      <path d="M14 8.2l-1.5 3.4" {...LIMB} />
      <path d="M13.6 8.8L6.6 11" {...LIMB} />
      <path d="M12.5 11.6l-3.5 1.4" {...LIMB} />
    </svg>
  );
}

function SwimmingIcon({ className }: IconProps) {
  // Nadador resaltado + olas tenues
  return (
    <svg viewBox="0 0 24 24" className={className} {...CARDIO_SVG}>
      {/* olas (contexto tenue) */}
      <path d="M2 17.5c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" {...FAINT} />
      <path d="M2 20.5c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" {...FAINT} />
      {/* nadador resaltado */}
      <circle cx="6.4" cy="8.6" r="1.7" {...FILL} />
      <path d="M7.6 9.4l4-2 4 .4 3-1.4" {...LIMB} />
      <path d="M6 10.4l2.2 2.8 3.8-0.8" {...LIMB} />
    </svg>
  );
}

function EllipticalIcon({ className }: IconProps) {
  // Figura en elíptica resaltada sobre máquina tenue
  return (
    <svg viewBox="0 0 24 24" className={className} {...CARDIO_SVG}>
      {/* máquina (contexto tenue) */}
      <path d="M3 20.5h18" {...FAINT} />
      <circle cx="5.5" cy="15" r="1.8" {...FAINT} />
      <path d="M6.8 13.8l4 2.6M5 16.4l-1.5 3.4" {...FAINT} />
      {/* figura resaltada */}
      <circle cx="13" cy="4.4" r="1.7" {...FILL} />
      <path d="M13 6.1v5.4" {...LIMB} />
      <path d="M13 7l3 1.5" {...LIMB} />
      <path d="M13 11.5l-2.5 4.5M13 11.5l3 4" {...LIMB} />
    </svg>
  );
}

function JumpRopeIcon({ className }: IconProps) {
  // Saltador resaltado + cuerda tenue
  return (
    <svg viewBox="0 0 24 24" className={className} {...CARDIO_SVG}>
      {/* cuerda (contexto tenue) */}
      <path d="M3.5 12c1-5.5 4-8 8.5-8s7.5 2.5 8.5 8" {...FAINT} />
      {/* saltador resaltado */}
      <circle cx="12" cy="5.2" r="1.7" {...FILL} />
      <path d="M12 7v5.5" {...LIMB} />
      <path d="M12 8L8.2 10M12 8l3.8 2" {...LIMB} />
      <path d="M12 12.5l-2 5M12 12.5l2 5" {...LIMB} />
    </svg>
  );
}

function DumbbellIcon({ className }: IconProps) {
  // Mancuerna duotono (discos rellenos), igual que "Otro" en músculos
  return (
    <svg viewBox="0 0 24 24" className={className} {...CARDIO_SVG} strokeWidth={1.5}>
      <path d="M2 12h2M20 12h2" />
      <rect x="3.5" y="8" width="3" height="8" rx="0.7" fill="currentColor" fillOpacity="0.55" />
      <rect x="17.5" y="8" width="3" height="8" rx="0.7" fill="currentColor" fillOpacity="0.55" />
      <path d="M6.5 12h11" />
    </svg>
  );
}

type IconComponent = React.ComponentType<{ className?: string }>;

const CARDIO_ICONS: Record<CardioType, IconComponent> = {
  running: TreadmillIcon,
  cycling: BikeIcon,
  walking: WalkingIcon,
  rowing: RowingMachineIcon,
  swimming: SwimmingIcon,
  elliptical: EllipticalIcon,
  jump_rope: JumpRopeIcon,
  other: DumbbellIcon,
};

export function CardioTypeIcon({
  type,
  className = 'w-5 h-5',
}: {
  type: CardioType;
  className?: string;
}) {
  const Icon = CARDIO_ICONS[type] ?? DumbbellIcon;
  return <Icon className={className} />;
}

/* ────────────────────────────  MUSCLES  ────────────────────────────
   Estilo "body highlight": silueta corporal tenue + zona del grupo
   muscular rellena en currentColor. La silueta da contexto anatómico
   (QUÉ parte del cuerpo es) y la zona iluminada hereda el color del
   grupo (MUSCLE_COLORS) vía currentColor. */

const MUSCLE_SVG = {
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeWidth: 1.1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/* Siluetas base compartidas (trazo tenue) */
const TORSO_FRONT =
  'M12 6.1C10 6.1 8.2 6.5 6.8 7.2C6.5 9.8 6.7 12.4 7.4 14.9C7.9 16.7 8.5 18.4 9.2 19.9L14.8 19.9C15.5 18.4 16.1 16.7 16.6 14.9C17.3 12.4 17.5 9.8 17.2 7.2C15.8 6.5 14 6.1 12 6.1Z';
const ARM_FLEX =
  'M9.8 3.4C8.6 3.9 8.1 5.3 8.7 6.5L10 8.6C10.6 9.6 11 10.5 11.2 11.5C9.9 10.6 8.2 10.5 6.8 11.3C5.4 12.1 4.5 13.5 4.3 15.2C4.1 17 4.9 18.7 6.4 19.6C9.6 20.9 14.2 20.7 17 19C18.8 17.9 19.8 16.4 19.7 14.6C19.6 13.4 19 12.5 18 12.1L13.4 6.1C13 4.2 11.4 2.9 9.8 3.4Z';
const LEGS_FRONT =
  'M7.5 4L16.5 4C17 6.5 17.2 9 17 11.5C16.8 14 16.2 17 15.3 20L13.6 20C13.2 17.5 13 15 13 12.5L12.7 10L11.3 10L11 12.5C11 15 10.8 17.5 10.4 20L8.7 20C7.8 17 7.2 14 7 11.5C6.8 9 7 6.5 7.5 4Z';

function Head() {
  return <circle cx="12" cy="3.4" r="1.7" strokeOpacity="0.3" />;
}

function MuscleFigure({
  className,
  base,
  withHead = true,
  children,
}: IconProps & { base: string; withHead?: boolean; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...MUSCLE_SVG}>
      {withHead && <Head />}
      <path d={base} strokeOpacity="0.3" />
      {children}
    </svg>
  );
}

export function MuscleGroupIcon({ name, className = 'w-5 h-5' }: IconProps & { name: string }) {
  const base = { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  const icons: Record<string, React.ReactElement> = {
    Pecho: (
      <MuscleFigure className={className} base={TORSO_FRONT}>
        <path
          d="M7.1 7.3C8.5 6.6 10.2 6.2 11.8 6.3L11.8 10.2C10.8 11.2 9.5 11.5 8.1 11.1C7.5 9.9 7.2 8.6 7.1 7.3Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
        <path
          d="M16.9 7.3C15.5 6.6 13.8 6.2 12.2 6.3L12.2 10.2C13.2 11.2 14.5 11.5 15.9 11.1C16.5 9.9 16.8 8.6 16.9 7.3Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
      </MuscleFigure>
    ),
    Espalda: (
      <MuscleFigure className={className} base={TORSO_FRONT}>
        <path
          d="M7.6 7.9C9 8.5 10.4 8.8 11.7 8.8L11.7 18C10.6 17.3 9.6 16.1 8.8 14.6C7.7 12.5 7.3 10.2 7.6 7.9Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
        <path
          d="M16.4 7.9C15 8.5 13.6 8.8 12.3 8.8L12.3 18C13.4 17.3 14.4 16.1 15.2 14.6C16.3 12.5 16.7 10.2 16.4 7.9Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
      </MuscleFigure>
    ),
    Pierna: (
      <MuscleFigure className={className} base={LEGS_FRONT} withHead={false}>
        <path
          d="M7.3 8C8.4 8.8 9.6 9.2 11 9.3L10.9 14.5C10.3 15.8 9.5 16.6 8.5 16.9C7.8 14 7.4 11 7.3 8Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
        <path
          d="M16.7 8C15.6 8.8 14.4 9.2 13 9.3L13.1 14.5C13.7 15.8 14.5 16.6 15.5 16.9C16.2 14 16.6 11 16.7 8Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
      </MuscleFigure>
    ),
    Hombro: (
      <MuscleFigure className={className} base={TORSO_FRONT}>
        <path
          d="M6.8 7.2C8 6.6 9.4 6.3 10.7 6.2C10.7 8 9.9 9.4 8.3 10C7.5 9.2 7 8.3 6.8 7.2Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
        <path
          d="M17.2 7.2C16 6.6 14.6 6.3 13.3 6.2C13.3 8 14.1 9.4 15.7 10C16.5 9.2 17 8.3 17.2 7.2Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
      </MuscleFigure>
    ),
    Brazos: (
      <MuscleFigure className={className} base={ARM_FLEX} withHead={false}>
        <path d={ARM_FLEX} fill="currentColor" fillOpacity="0.45" strokeWidth="0.9" />
      </MuscleFigure>
    ),
    Bíceps: (
      <MuscleFigure className={className} base={ARM_FLEX} withHead={false}>
        <path
          d="M11.2 11.5C9.9 10.6 8.2 10.5 6.8 11.3C5.4 12.1 4.5 13.5 4.3 15.2C6.8 16.2 9.6 15.7 11.6 13.9C11.6 13.1 11.5 12.3 11.2 11.5Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
      </MuscleFigure>
    ),
    Tríceps: (
      <MuscleFigure className={className} base={ARM_FLEX} withHead={false}>
        <path
          d="M6.4 19.6C4.9 18.7 4.1 17 4.3 15.2C6.8 16.2 9.6 15.7 11.6 13.9C13.7 14.6 15.9 14.4 17.9 13.4C18.6 15.4 17.9 17.5 15.9 18.8C13.2 20.5 9.2 20.7 6.4 19.6Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
      </MuscleFigure>
    ),
    Antebrazo: (
      <MuscleFigure className={className} base={ARM_FLEX} withHead={false}>
        <path
          d="M9.8 3.4C11.4 2.9 13 4.2 13.4 6.1L18 12.1C16.9 12.9 15.6 13.1 14.2 12.7C12.6 11.5 11.3 10.2 10 8.6L8.7 6.5C8.1 5.3 8.6 3.9 9.8 3.4Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
      </MuscleFigure>
    ),
    Glúteo: (
      <MuscleFigure className={className} base={LEGS_FRONT} withHead={false}>
        <path
          d="M7.8 5.3C9 4.8 10.3 4.9 11.4 5.6C11.9 7.3 11.7 9 10.8 10.3C9.6 10.9 8.5 10.7 7.6 9.8C7.2 8.3 7.3 6.8 7.8 5.3Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
        <path
          d="M16.2 5.3C15 4.8 13.7 4.9 12.6 5.6C12.1 7.3 12.3 9 13.2 10.3C14.4 10.9 15.5 10.7 16.4 9.8C16.8 8.3 16.7 6.8 16.2 5.3Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
      </MuscleFigure>
    ),
    Core: (
      <MuscleFigure className={className} base={TORSO_FRONT}>
        {[
          [9.9, 10.6],
          [12.3, 10.6],
          [9.9, 13],
          [12.3, 13],
          [10.1, 15.4],
          [12.3, 15.4],
        ].map(([x, y], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width="1.8"
            height="2"
            rx="0.5"
            fill="currentColor"
            fillOpacity="0.55"
            stroke="none"
          />
        ))}
      </MuscleFigure>
    ),
    Cardio: (
      <MuscleFigure className={className} base={TORSO_FRONT}>
        <path
          d="M12 13.6C10.3 12.3 8.9 11 8.9 9.4C8.9 8.3 9.7 7.5 10.7 7.5C11.2 7.5 11.7 7.8 12 8.3C12.3 7.8 12.8 7.5 13.3 7.5C14.3 7.5 15.1 8.3 15.1 9.4C15.1 11 13.7 12.3 12 13.6Z"
          fill="currentColor"
          fillOpacity="0.55"
          strokeWidth="0.9"
        />
      </MuscleFigure>
    ),
    Otro: (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        {...base}
      >
        <path d="M2 12h2M20 12h2" />
        <rect x="3.5" y="8" width="3" height="8" rx="0.7" fill="currentColor" fillOpacity="0.15" />
        <rect x="17.5" y="8" width="3" height="8" rx="0.7" fill="currentColor" fillOpacity="0.15" />
        <path d="M6.5 12h11" />
      </svg>
    ),
  };

  return (
    icons[name] ?? (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        {...base}
      >
        <circle cx="12" cy="12" r="9" />
      </svg>
    )
  );
}
