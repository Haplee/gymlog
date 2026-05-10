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
  const base = { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  const icons: Record<string, React.ReactElement> = {
    Pecho: (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        {...base}
      >
        {/* Silueta anatómica del pecho — dos lóbulos pectorales */}
        <path
          d="M3.5 9C3.5 6.5 5.5 4.5 8.5 4.5C10 4.5 11.5 5.5 12 8C12.5 5.5 14 4.5 15.5 4.5C18.5 4.5 20.5 6.5 20.5 9C20.5 13.5 17 17.5 12 20.5C7 17.5 3.5 13.5 3.5 9Z"
          fill="currentColor"
          fillOpacity="0.2"
        />
        {/* Esternón */}
        <line x1="12" y1="5" x2="12" y2="19" strokeOpacity="0.35" strokeWidth="1" />
        {/* Pliegue pectoral izquierdo */}
        <path d="M5 11.5C7.5 13.5 10.5 13 11.5 11" strokeOpacity="0.65" strokeWidth="1.1" />
        {/* Pliegue pectoral derecho */}
        <path d="M19 11.5C16.5 13.5 13.5 13 12.5 11" strokeOpacity="0.65" strokeWidth="1.1" />
      </svg>
    ),
    Espalda: (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        {...base}
      >
        {/* Silueta anatómica de la espalda — V-taper con dorsales */}
        <path
          d="M4.5 8.5C5.5 5.5 7.5 4 10 4H14C16.5 4 18.5 5.5 19.5 8.5C20.5 11.5 20 15 18 18L12 21.5L6 18C4 15 3.5 11.5 4.5 8.5Z"
          fill="currentColor"
          fillOpacity="0.15"
        />
        {/* Columna vertebral */}
        <path d="M12 4.5V20.5" strokeOpacity="0.35" strokeWidth="1" />
        {/* Vértebras */}
        <path d="M11 9H13M11 12H13M11 15H13" strokeOpacity="0.45" strokeWidth="0.9" />
        {/* Dorsal izquierdo */}
        <path d="M6 9.5C7 13 7.5 16 7.5 18.5" strokeOpacity="0.55" strokeWidth="1.1" />
        {/* Dorsal derecho */}
        <path d="M18 9.5C17 13 16.5 16 16.5 18.5" strokeOpacity="0.55" strokeWidth="1.1" />
      </svg>
    ),
    Pierna: (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        {...base}
      >
        {/* Cuádriceps — vista frontal */}
        <path
          d="M8 2.5C6.5 2.5 5.5 3.5 5 5.5L4 14C4 15.5 5.5 16.5 9 17H15C18.5 16.5 20 15.5 20 14L19 5.5C18.5 3.5 17.5 2.5 16 2.5H8Z"
          fill="currentColor"
          fillOpacity="0.15"
        />
        {/* Rótula */}
        <ellipse
          cx="12"
          cy="17.5"
          rx="3.5"
          ry="1.6"
          fill="currentColor"
          fillOpacity="0.3"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        {/* Parte inferior de la pierna */}
        <path d="M9.5 19.5L8.5 23" />
        <path d="M14.5 19.5L15.5 23" />
        {/* Líneas del cuádriceps */}
        <path d="M9 7Q12 6.5 15 7" strokeOpacity="0.45" strokeWidth="1" />
        <path d="M8.5 11Q12 10.5 15.5 11" strokeOpacity="0.45" strokeWidth="1" />
      </svg>
    ),
    Hombro: (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        {...base}
      >
        {/* Deltoides — vista frontal con los tres haces */}
        <path
          d="M5 13C5 8 8 4.5 12 4.5C16 4.5 19 8 19 13C19 16 17 18.5 14.5 19.5L12 20.5L9.5 19.5C7 18.5 5 16 5 13Z"
          fill="currentColor"
          fillOpacity="0.2"
        />
        {/* Brazos */}
        <path d="M9.5 19.5L8.5 23M14.5 19.5L15.5 23" />
        {/* Haz anterior */}
        <path d="M7 10C8.5 7.5 10.5 6.5 12 6.5" strokeOpacity="0.5" strokeWidth="1.1" />
        {/* Haz posterior */}
        <path d="M17 10C15.5 7.5 13.5 6.5 12 6.5" strokeOpacity="0.5" strokeWidth="1.1" />
        {/* Clavícula */}
        <path d="M6.5 8Q12 5.5 17.5 8" strokeOpacity="0.35" strokeWidth="0.9" />
      </svg>
    ),
    Brazos: (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        {...base}
      >
        {/* Brazo flexionado — bíceps y antebrazo */}
        <path
          d="M5 19V11C5 7.5 7 5 10 5C13 5 15 7.5 15 11V12"
          fill="currentColor"
          fillOpacity="0.1"
        />
        <path
          d="M15 12C18 12 20 13.5 20 16.5C20 19.5 18 20.5 15 20.5H5"
          fill="currentColor"
          fillOpacity="0.1"
        />
        <path d="M5 5V19" />
        <path d="M15 5V11" />
        <path d="M15 12C18 12 20 13.5 20 16.5C20 19.5 18 21 15 21H5" />
        {/* Pico del bíceps */}
        <path d="M7.5 9C9.5 6.5 12.5 7 13.5 9.5" strokeOpacity="0.5" strokeWidth="1.1" />
      </svg>
    ),
    Bíceps: (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        {...base}
      >
        {/* Bíceps en contracción — pico muscular */}
        <path d="M3.5 18.5C6 11 12.5 5.5 20.5 5" />
        <path
          d="M7.5 11.5C8 8 12.5 7 14.5 10.5C16 13.5 13.5 16.5 10.5 15.5C8 14.5 7.5 13 7.5 11.5Z"
          fill="currentColor"
          fillOpacity="0.28"
        />
        <path d="M3.5 18.5C6 19.5 9 19.5 11 18" strokeOpacity="0.5" strokeWidth="1.1" />
        <path d="M10 15.5L8.5 19.5" strokeOpacity="0.4" strokeWidth="1" />
      </svg>
    ),
    Tríceps: (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        {...base}
      >
        {/* Tríceps — herradura, vista posterior */}
        <path d="M5.5 3.5C10 3 14 5.5 15 9.5C16 13.5 15 18 13.5 21.5" />
        <path d="M5.5 3.5L7 13" />
        <path
          d="M5.5 3.5C8.5 4 11 6 12 9C13 12 12.5 17 13 21C12 21.5 8 22.5 7 13Z"
          fill="currentColor"
          fillOpacity="0.2"
        />
        {/* Cabezas del tríceps */}
        <path d="M7 9.5C9.5 9 12 9.5 13.5 11" strokeOpacity="0.5" strokeWidth="1.1" />
        <path d="M7.5 13.5C10 13 12.5 13.5 14 15" strokeOpacity="0.5" strokeWidth="1.1" />
      </svg>
    ),
    Antebrazo: (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        {...base}
      >
        {/* Antebrazo — silueta fusiforme con extensores y flexores */}
        <path
          d="M5.5 6C8.5 4.5 13 4.5 16 6.5L17.5 16C16 19 13 20 10 19.5C7 19 5 17 6.5 16.5L5.5 6Z"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <path d="M5.5 6L6.5 16.5" />
        <path d="M16 6.5L17.5 16" />
        <path d="M6.5 10Q11 9.5 15.5 11" strokeOpacity="0.45" strokeWidth="1" />
        <path d="M6.5 14Q11 13.5 16 15" strokeOpacity="0.45" strokeWidth="1" />
      </svg>
    ),
    Glúteo: (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        {...base}
      >
        {/* Glúteos — vista posterior, dos lóbulos */}
        <path
          d="M3 14.5C3 10.5 5.5 7 8.5 7C11 7 12.5 9.5 12 14C11.5 17.5 10 20.5 7.5 21C5.5 21 3 18.5 3 14.5Z"
          fill="currentColor"
          fillOpacity="0.2"
        />
        <path
          d="M21 14.5C21 10.5 18.5 7 15.5 7C13 7 11.5 9.5 12 14C12.5 17.5 14 20.5 16.5 21C18.5 21 21 18.5 21 14.5Z"
          fill="currentColor"
          fillOpacity="0.2"
        />
        <line x1="12" y1="7.5" x2="12" y2="20.5" strokeOpacity="0.3" strokeWidth="0.9" />
      </svg>
    ),
    Core: (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        {...base}
      >
        {/* Abdominales — six-pack con forma de torso */}
        <path
          d="M8 3.5C7 3 6.5 3.5 7.5 4.5L6.5 16C6.5 18.5 9 20.5 12 20.5C15 20.5 17.5 18.5 17.5 16L16.5 4.5C17.5 3.5 17 3 16 3.5H8Z"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <line x1="12" y1="3.5" x2="12" y2="20" strokeOpacity="0.4" strokeWidth="1" />
        <line x1="7" y1="9" x2="17" y2="9" strokeOpacity="0.5" strokeWidth="1" />
        <line x1="7" y1="13.5" x2="17" y2="13.5" strokeOpacity="0.5" strokeWidth="1" />
        <path d="M7 17.5Q9.5 19 12 18Q14.5 19 17 17.5" strokeOpacity="0.4" strokeWidth="1" />
      </svg>
    ),
    Cardio: (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        {...base}
      >
        <path
          d="M12 20c-4-3-8-6-8-11 0-2.5 2-4.5 4.5-4.5C10 4.5 11 5.5 12 7c1-1.5 2-2.5 3.5-2.5C18 4.5 20 6.5 20 9c0 5-4 8-8 11z"
          fill="currentColor"
          fillOpacity="0.18"
        />
        <polyline points="5.5,12 8.5,12 10.5,9 12.5,15 14.5,11 17.5,12" />
      </svg>
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
