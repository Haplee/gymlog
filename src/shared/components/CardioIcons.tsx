import type { CardioType } from '@features/cardio/stores/cardioStore';

interface IconProps {
  className?: string;
}

const SVG_BASE = {
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/* ────────────────────────────  CARDIO  ──────────────────────────── */

function TreadmillIcon({ className }: IconProps) {
  // Person running on treadmill platform
  return (
    <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
      {/* runner head */}
      <circle cx="11" cy="4.5" r="1.3" />
      {/* torso lean */}
      <path d="M11 6l-1 4" />
      {/* back arm */}
      <path d="M11 6.8l-2.5 1.8" />
      {/* front arm */}
      <path d="M11 6.8l2.4 1.6" />
      {/* front leg */}
      <path d="M10 10l2 4" />
      {/* back leg */}
      <path d="M10 10l-2.2 3.6" />
      {/* treadmill belt platform */}
      <path d="M3 16h13l4 4H7" />
      {/* console post */}
      <path d="M16 16V9.5" />
      {/* console screen */}
      <rect x="14.5" y="6.5" width="4" height="3" rx="0.5" />
    </svg>
  );
}

function BikeIcon({ className }: IconProps) {
  // Two wheels with frame + handlebar (more bike-like than lucide default)
  return (
    <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
      <circle cx="5.5" cy="17" r="3.5" />
      <circle cx="18.5" cy="17" r="3.5" />
      {/* frame */}
      <path d="M5.5 17l4-7h5l-3 7" />
      <path d="M9.5 10l3 7" />
      {/* seat */}
      <path d="M14 7.5h-2" />
      {/* seat post */}
      <path d="M13 7.5l-1.5 2.5" />
      {/* handlebar */}
      <path d="M16 6.5h-2.5" />
      {/* fork */}
      <path d="M14.5 6.5L18.5 17" />
    </svg>
  );
}

function WalkingIcon({ className }: IconProps) {
  // Walking figure (single side profile)
  return (
    <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
      <circle cx="13" cy="3.5" r="1.4" />
      {/* torso */}
      <path d="M13 5.5l-1 5" />
      {/* arm forward */}
      <path d="M13 6.5l2.5 2" />
      {/* arm back */}
      <path d="M12.5 7L10 9" />
      {/* front leg */}
      <path d="M12 10.5l1.5 5 0 4" />
      {/* back leg */}
      <path d="M12 10.5l-2.5 4 -1 4.5" />
      {/* ground */}
      <path d="M5 21h14" strokeOpacity="0.35" />
    </svg>
  );
}

function RowingMachineIcon({ className }: IconProps) {
  // Rowing-machine side profile
  return (
    <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
      {/* flywheel */}
      <circle cx="4.5" cy="13.5" r="2.5" />
      <line x1="4.5" y1="11" x2="4.5" y2="16" strokeOpacity="0.4" />
      {/* rail */}
      <path d="M7 14h13" />
      {/* seat */}
      <rect x="13" y="11.5" width="3.5" height="2" rx="0.5" />
      {/* foot pedals */}
      <path d="M6.5 11.5h2.5" />
      {/* handle bar */}
      <path d="M9 6h4" />
      {/* cable from flywheel to handle */}
      <path d="M4.8 11.2L11 6.5" />
      {/* base feet */}
      <path d="M3 18h2M19 18h2" />
    </svg>
  );
}

function SwimmingIcon({ className }: IconProps) {
  // Swimmer head + arm + waves
  return (
    <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
      {/* head */}
      <circle cx="6.5" cy="9" r="1.5" />
      {/* arm extended */}
      <path d="M8 9l4-2 4 .5 3-1.5" />
      {/* body underwater */}
      <path d="M5.5 10.5l2 3 4-1 3.5 1.5" />
      {/* waves */}
      <path d="M2 17.5c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
      <path d="M2 20.5c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" strokeOpacity="0.4" />
    </svg>
  );
}

function EllipticalIcon({ className }: IconProps) {
  // Elliptical machine: handles + pedal arc
  return (
    <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
      {/* base */}
      <path d="M3 20h18" />
      {/* flywheel */}
      <circle cx="6" cy="14" r="2" />
      <circle cx="6" cy="14" r="0.4" fill="currentColor" stroke="none" />
      {/* pedal arms */}
      <path d="M7.5 13L12 16l4 2" />
      <path d="M5 15.5l-2 4" />
      {/* handle posts */}
      <path d="M14 17V6" />
      <path d="M16 17V4" />
      {/* handles */}
      <path d="M13 6h2.5M15 4h2" />
    </svg>
  );
}

function JumpRopeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
      {/* head */}
      <circle cx="12" cy="5" r="1.5" />
      {/* rope arc above */}
      <path d="M3 11c1-5 4-7 9-7s8 2 9 7" />
      {/* torso */}
      <path d="M12 6.5v6" />
      {/* arms holding handles */}
      <path d="M12 7.5L8 9.5M12 7.5L16 9.5" />
      {/* legs together */}
      <path d="M12 12.5l-2 5M12 12.5l2 5" />
      {/* feet */}
      <path d="M9.5 18h1M13.5 18h1" />
    </svg>
  );
}

function DumbbellIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
      <path d="M2 12h2M20 12h2" />
      <rect x="3.5" y="8" width="3" height="8" rx="0.7" />
      <rect x="17.5" y="8" width="3" height="8" rx="0.7" />
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
