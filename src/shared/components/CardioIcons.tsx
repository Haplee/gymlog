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

/* ────────────────────────────  MUSCLES  ──────────────────────────── */

export function MuscleGroupIcon({ name, className = 'w-5 h-5' }: IconProps & { name: string }) {
  const icons: Record<string, React.ReactElement> = {
    Pecho: (
      // Two pec halves
      <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
        <path d="M3 7c0-1.5 1-2.5 3-2.5 2.5 0 4 1.5 5.5 4.5C13 6 14.5 4.5 17 4.5c2 0 3 1 3 2.5 0 4.5-3.5 8-8 11-4.5-3-9-6.5-9-11z" />
        <path d="M11.5 9c-1 1-2.5 1.6-4.5 1.5" strokeOpacity="0.45" />
        <path d="M12.5 9c1 1 2.5 1.6 4.5 1.5" strokeOpacity="0.45" />
      </svg>
    ),
    Espalda: (
      // Back V-taper with spine + lats
      <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
        {/* shoulders / lats */}
        <path d="M4 6c1 5 4 8 8 9 4-1 7-4 8-9" />
        {/* lats sides */}
        <path d="M5 6c1 4 2 7 2.5 13" />
        <path d="M19 6c-1 4-2 7-2.5 13" />
        {/* spine */}
        <line x1="12" y1="6" x2="12" y2="20" />
        {/* spine notches */}
        <path d="M11 10h2M11 13h2M11 16h2" strokeOpacity="0.5" />
      </svg>
    ),
    Pierna: (
      // Quad/hamstring side profile
      <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
        {/* upper leg / quad */}
        <path d="M8 3c4 0 6 1.5 6.5 5.5l1 6.5" />
        <path d="M8 3l-0.5 11" />
        {/* knee */}
        <ellipse cx="11" cy="14.5" rx="3.5" ry="1.4" />
        {/* lower leg */}
        <path d="M9 16l-0.5 5" />
        <path d="M14 16l1 5" />
        {/* foot */}
        <path d="M7 21h3M13.5 21h3.5" />
      </svg>
    ),
    Hombro: (
      // Deltoid cap with arm hint
      <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
        {/* deltoid bulb */}
        <path d="M5 13c0-5 3.5-8 7-8s7 3 7 8" />
        {/* clavicle line */}
        <path d="M5 13c2-1 5-1.5 7-1.5s5 0.5 7 1.5" strokeOpacity="0.5" />
        {/* arm down */}
        <path d="M5 13l-1 7" />
        <path d="M19 13l1 7" />
        {/* neck */}
        <path d="M11 5l-0.5-2M13 5l0.5-2" strokeOpacity="0.5" />
      </svg>
    ),
    Brazos: (
      // Flexed arm
      <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
        <path d="M5 19V11c0-3 2-5 5-5s5 2 5 5v0.5" />
        <path d="M15 11.5c2.5 0.5 4 2 4 4.5s-2 4-4.5 4H5" />
        {/* bicep peak */}
        <path d="M8 10c1.5-2 4-2 5.5 0" strokeOpacity="0.5" />
      </svg>
    ),
    Bíceps: (
      // Bicep peak with arm bend (anatomical)
      <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
        {/* upper arm outline (flexed) */}
        <path d="M3 17c2-7 8-11 16-12" />
        {/* bicep bulge */}
        <path d="M8 11c2-4 6-3 7 0c1 3-2 5-5 4c-2-0.5-2-2-2-4z" />
        {/* forearm hint */}
        <path d="M3 17c2 1 4 1.5 5.5 0.5" strokeOpacity="0.5" />
      </svg>
    ),
    Tríceps: (
      // Triceps horseshoe (back of arm)
      <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
        {/* arm outline */}
        <path d="M5 3c4 1 7 4 8 9l-1 9" />
        <path d="M5 3l1 8" />
        {/* triceps three heads */}
        <path d="M7 8c2 1 3 3 3 5" strokeOpacity="0.5" />
        <path d="M7 11c2.5 0 4 1.5 4 3" strokeOpacity="0.5" />
        <path d="M7 14c2 0 3.5 1 3.5 2.5" strokeOpacity="0.5" />
      </svg>
    ),
    Antebrazo: (
      // Forearm with hand fist
      <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
        <path d="M4 9l11 9" />
        <path d="M5 6l9 11" />
        {/* fist */}
        <circle cx="17" cy="18" r="3" />
        <path d="M16 16.5h2M16 18h2M16 19.5h2" strokeOpacity="0.5" />
      </svg>
    ),
    Glúteo: (
      // Two glute halves
      <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
        <path d="M3 14c0-4 2.5-7 5.5-7s5 3 4.5 8c-0.3 3-2 5-4.5 5s-5.5-2-5.5-6z" />
        <path d="M21 14c0-4-2.5-7-5.5-7s-5 3-4.5 8c0.3 3 2 5 4.5 5s5.5-2 5.5-6z" />
        <line x1="12" y1="7" x2="12" y2="20" strokeOpacity="0.4" />
      </svg>
    ),
    Core: (
      // Six-pack abs grid
      <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
        <path d="M7 4c0-0.5 0.5-1 1-1h8c0.5 0 1 0.5 1 1v15c0 1.5-2 2-5 2s-5-0.5-5-2z" />
        <line x1="12" y1="3" x2="12" y2="20" />
        <line x1="7" y1="8.5" x2="17" y2="8.5" />
        <line x1="7" y1="13" x2="17" y2="13" />
        <line x1="7.5" y1="17" x2="16.5" y2="17" strokeOpacity="0.5" />
      </svg>
    ),
    Cardio: (
      // Heart with pulse line
      <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
        <path d="M12 20c-4-3-8-6-8-11 0-2.5 2-4.5 4.5-4.5C10 4.5 11 5.5 12 7c1-1.5 2-2.5 3.5-2.5C18 4.5 20 6.5 20 9c0 5-4 8-8 11z" />
        <polyline points="6,12 9,12 11,9 13,15 15,11 18,12" />
      </svg>
    ),
    Otro: (
      <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
        <path d="M2 12h2M20 12h2" />
        <rect x="3.5" y="8" width="3" height="8" rx="0.7" />
        <rect x="17.5" y="8" width="3" height="8" rx="0.7" />
        <path d="M6.5 12h11" />
      </svg>
    ),
  };

  return (
    icons[name] ?? (
      <svg viewBox="0 0 24 24" className={className} {...SVG_BASE}>
        <circle cx="12" cy="12" r="9" />
      </svg>
    )
  );
}
