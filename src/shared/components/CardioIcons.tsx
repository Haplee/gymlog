import type { CardioType } from '@features/cardio/stores/cardioStore';
import {
  Activity,
  Bicycle,
  Dumbbell,
  Run,
  Ship,
  Swimming,
  Timer,
  Walk,
  type IconComponent,
} from '@shared/components/icons';

interface IconProps {
  className?: string;
}

/* ────────────────────────────  CARDIO  ────────────────────────────
   Iconos de la librería en vez de SVG a mano: son limpios, consistentes entre
   sí y reconocibles a tamaño pequeño. Como cada botón lleva además su etiqueta
   ("Correr", "Remo"…), basta con un glifo semántico claro. Las máquinas sin
   icono propio (remo, elíptica, comba) usan el más cercano: barca (deporte de
   agua), pulso de cardio y cronómetro. */

const CARDIO_ICONS: Record<CardioType, IconComponent> = {
  running: Run,
  cycling: Bicycle,
  walking: Walk,
  rowing: Ship,
  swimming: Swimming,
  elliptical: Activity,
  jump_rope: Timer,
  other: Dumbbell,
};

export function CardioTypeIcon({
  type,
  className = 'w-5 h-5',
}: {
  type: CardioType;
  className?: string;
}) {
  const Icon = CARDIO_ICONS[type] ?? Dumbbell;
  return <Icon className={className} strokeWidth={1.8} />;
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
