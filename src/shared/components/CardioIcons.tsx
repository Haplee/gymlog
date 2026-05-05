import { Bike, Footprints, RefreshCcw, Zap, WavesLadder } from 'lucide-react';
import type { CardioType } from '@features/cardio/stores/cardioStore';

interface IconProps {
  className?: string;
}

function RunningIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="14" cy="3.5" r="1.5" />
      {/* Torso (forward lean) */}
      <path d="M12.5 5.5L10 11" />
      {/* Arm forward */}
      <path d="M12.5 5.5L15.5 8" />
      {/* Arm back */}
      <path d="M10.5 8.5L7.5 7" />
      {/* Front leg */}
      <path d="M10 11L8 16.5 9.5 19" />
      {/* Back leg */}
      <path d="M10 11L13.5 14 15 12.5" />
    </svg>
  );
}

function RowingIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Water waves */}
      <path d="M3 18c3-4 6.5-4 10 0 3-4 6.5-4 9 0" />
      {/* Left oar */}
      <path d="M7 4l3.5 9" />
      {/* Right oar */}
      <path d="M17 4l-3.5 9" />
      {/* Oar grips */}
      <path d="M4.5 4h5" />
      <path d="M14.5 4h5" />
    </svg>
  );
}

function JumpRopeIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Head */}
      <circle cx="12" cy="3.5" r="1.5" />
      {/* Rope arc */}
      <path d="M5 7c2-4.5 5-4.5 7-2.5 2-2 5-2 7 2.5" />
      {/* Body left side */}
      <path d="M10 6.5L8 12.5l2 2" />
      {/* Body right side */}
      <path d="M14 6.5l2 6-2 2" />
      {/* Legs together (airborne) */}
      <path d="M10 14.5l2 5.5 2-5.5" />
    </svg>
  );
}

type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>;

const CARDIO_ICONS: Record<CardioType, IconComponent> = {
  running: RunningIcon,
  cycling: Bike,
  walking: Footprints,
  rowing: RowingIcon,
  swimming: WavesLadder,
  elliptical: RefreshCcw,
  jump_rope: JumpRopeIcon,
  other: Zap,
};

export function CardioTypeIcon({
  type,
  className = 'w-5 h-5',
}: {
  type: CardioType;
  className?: string;
}) {
  const Icon = CARDIO_ICONS[type] ?? Zap;
  return <Icon className={className} strokeWidth={1.75} />;
}

export function MuscleGroupIcon({ name, className = 'w-5 h-5' }: IconProps & { name: string }) {
  const s = {
    fill: 'none' as const,
    stroke: 'currentColor' as const,
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const icons: Record<string, React.ReactElement> = {
    Pecho: (
      <svg viewBox="0 0 24 24" className={className} {...s}>
        <path d="M3 8c0-2 1.5-3.5 4-3.5h2l3 4.5 3-4.5h2c2.5 0 4 1.5 4 3.5v2.5c0 3.5-3 7-9 9-6-2-9-5.5-9-9V8z" />
      </svg>
    ),
    Espalda: (
      <svg viewBox="0 0 24 24" className={className} {...s}>
        <line x1="12" y1="3" x2="12" y2="21" />
        <path d="M4 6c0 4.5 3.5 7.5 8 8.5" />
        <path d="M20 6c0 4.5-3.5 7.5-8 8.5" />
        <path d="M4 12.5l8 4 8-4" />
      </svg>
    ),
    Pierna: (
      <svg viewBox="0 0 24 24" className={className} {...s}>
        <path d="M9 2L8 13l-2 4 1 5h3.5" />
        <path d="M15 2l1 11 2 4-1 5h-3.5" />
        <line x1="8.5" y1="13" x2="15.5" y2="13" />
      </svg>
    ),
    Hombro: (
      <svg viewBox="0 0 24 24" className={className} {...s}>
        <path d="M5 13c0-4.5 3-7.5 7-7.5S19 8.5 19 13" />
        <path d="M3 17l2-4" />
        <path d="M21 17l-2-4" />
        <line x1="6" y1="17" x2="18" y2="17" />
      </svg>
    ),
    Brazos: (
      <svg viewBox="0 0 24 24" className={className} {...s}>
        <path d="M8 21V10c0-2.5 1.5-4.5 4-4.5S16 7.5 16 10v2" />
        <path d="M16 12c2.5 0 4 1.5 4 4s-1.5 4-4 4H8" />
        <line x1="12" y1="20" x2="12" y2="23" />
      </svg>
    ),
    Glúteo: (
      <svg viewBox="0 0 24 24" className={className} {...s}>
        <path d="M4 12c0-3 2.5-5.5 5.5-5.5S15 9 15 12c0 3.5-2 6-5.5 6S4 15.5 4 12z" />
        <path d="M10 12c0-3 2.5-5.5 5.5-5.5S21 9 21 12c0 3.5-2 6-5.5 6" />
      </svg>
    ),
    Core: (
      <svg viewBox="0 0 24 24" className={className} {...s}>
        <rect x="7.5" y="3" width="9" height="18" rx="3" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="7.5" y1="9" x2="16.5" y2="9" />
        <line x1="7.5" y1="15" x2="16.5" y2="15" />
      </svg>
    ),
    Cardio: (
      <svg viewBox="0 0 24 24" className={className} {...s}>
        <polyline points="2,12 5,12 7.5,5 10.5,19 13.5,8 16,15 18,12 22,12" />
      </svg>
    ),
    Otro: (
      <svg viewBox="0 0 24 24" className={className} {...s}>
        <circle cx="12" cy="12" r="9" />
        <polyline points="12,7 12,12 15.5,14.5" />
      </svg>
    ),
  };

  return (
    icons[name] ?? (
      <svg viewBox="0 0 24 24" className={className} {...s}>
        <circle cx="12" cy="12" r="9" />
      </svg>
    )
  );
}
