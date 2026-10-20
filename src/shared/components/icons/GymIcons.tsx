/**
 * Set de iconos propio de GymLog.
 *
 * Dibujados a mano sobre una rejilla de 24×24 con el criterio de un emoji:
 * silueta rellena, formas gruesas y esquinas redondeadas, legibles a 20 px en
 * la barra inferior. Nada de trazos finos — por eso no se parecen a los de
 * lucide y por eso funcionan sobre el amarillo del acento.
 *
 * Todos heredan el color con `currentColor`, así que se tiñen con las
 * utilidades de texto (`text-accent`, `text-accent-fg`…) como cualquier icono.
 */
import { memo } from 'react';

export interface GymIconProps {
  className?: string;
}

// Props comunes; el tamaño lo pone quien lo usa con las clases de ancho/alto.
const svgProps = (className = '') =>
  ({
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    'aria-hidden': true,
    focusable: false,
  }) as const;

/** Casa maciza con tejado a dos aguas y puerta calada. */
export const IconHome = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path d="M11.32 2.28a1 1 0 0 1 1.36 0l9.5 8.75a1 1 0 0 1-.68 1.74H20v7.73A2.5 2.5 0 0 1 17.5 23H15a1 1 0 0 1-1-1v-4.6a2 2 0 0 0-4 0V22a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 20.5v-7.73H2.5a1 1 0 0 1-.68-1.74z" />
  </svg>
));
IconHome.displayName = 'IconHome';

/** Mancuerna: barra central con dos discos y sus topes. */
export const IconDumbbell = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <rect x="0.8" y="9.4" width="2.6" height="5.2" rx="1.3" />
    <rect x="4.3" y="6.6" width="3.7" height="10.8" rx="1.6" />
    <rect x="8" y="10.4" width="8" height="3.2" rx="1.6" />
    <rect x="16" y="6.6" width="3.7" height="10.8" rx="1.6" />
    <rect x="20.6" y="9.4" width="2.6" height="5.2" rx="1.3" />
  </svg>
));
IconDumbbell.displayName = 'IconDumbbell';

/**
 * Zapatilla de correr de perfil — el icono de cardio. Talón alto a la
 * izquierda, cuello del tobillo, puntera baja y suela aparte; los cordones van
 * calados con `evenodd` para que se lean sin depender del color del fondo.
 */
export const IconShoe = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.9 17.5V9.1a1.55 1.55 0 0 1 1.55-1.55h1.9A1.55 1.55 0 0 1 6.85 8.7l.74 2.83 2.1-.64a1.45 1.45 0 0 1 1.67.7l1.12 2.16 6.4 1.95a4.5 4.5 0 0 1 3.2 3.72.62.62 0 0 1-.62.69H2.5a.6.6 0 0 1-.6-.6zM10.15 12.5l4.4 1.35-.4 1.28-4.4-1.35zM9.5 14.75l4.4 1.35-.4 1.28-4.4-1.35z"
    />
    <rect x="1.2" y="20.2" width="21.6" height="2.6" rx="1.3" />
  </svg>
));
IconShoe.displayName = 'IconShoe';

/** Reloj de aro con agujas — historial. */
export const IconHistory = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1.6a10.4 10.4 0 1 0 0 20.8 10.4 10.4 0 0 0 0-20.8zm0 2.8a7.6 7.6 0 1 1 0 15.2 7.6 7.6 0 0 1 0-15.2z"
    />
    <path d="M12 6.2a1.2 1.2 0 0 1 1.2 1.2v4.02l2.72 1.6a1.2 1.2 0 1 1-1.22 2.07l-3.3-1.95a1.2 1.2 0 0 1-.6-1.04V7.4A1.2 1.2 0 0 1 12 6.2z" />
  </svg>
));
IconHistory.displayName = 'IconHistory';

/** Engranaje de ocho dientes con el eje calado — ajustes. */
export const IconGear = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13.55 1.4h-3.1a1.2 1.2 0 0 0-1.19 1.05l-.24 1.9a8.4 8.4 0 0 0-1.5.87l-1.78-.74a1.2 1.2 0 0 0-1.5.53L2.69 7.7a1.2 1.2 0 0 0 .3 1.54l1.5 1.2a8.4 8.4 0 0 0 0 1.72l-1.5 1.2a1.2 1.2 0 0 0-.3 1.54l1.55 2.69a1.2 1.2 0 0 0 1.5.53l1.78-.74c.47.34.97.63 1.5.87l.24 1.9a1.2 1.2 0 0 0 1.19 1.05h3.1a1.2 1.2 0 0 0 1.19-1.05l.24-1.9c.53-.24 1.03-.53 1.5-.87l1.78.74a1.2 1.2 0 0 0 1.5-.53l1.55-2.69a1.2 1.2 0 0 0-.3-1.54l-1.5-1.2a8.4 8.4 0 0 0 0-1.72l1.5-1.2a1.2 1.2 0 0 0 .3-1.54L19.76 5.01a1.2 1.2 0 0 0-1.5-.53l-1.78.74a8.4 8.4 0 0 0-1.5-.87l-.24-1.9a1.2 1.2 0 0 0-1.19-1.05zM12 8.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z"
    />
  </svg>
));
IconGear.displayName = 'IconGear';

/** Lupa maciza con mango redondeado. */
export const IconSearch = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.4 1.8a8.6 8.6 0 1 0 5.2 15.45l4.3 4.3a1.45 1.45 0 0 0 2.05-2.05l-4.3-4.3A8.6 8.6 0 0 0 10.4 1.8zm0 2.9a5.7 5.7 0 1 1 0 11.4 5.7 5.7 0 0 1 0-11.4z"
    />
  </svg>
));
IconSearch.displayName = 'IconSearch';

/** Busto de persona — cuenta y perfil. */
export const IconUser = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <circle cx="12" cy="7.4" r="4.6" />
    <path d="M3.3 20.2A8.9 8.9 0 0 1 12 13.6a8.9 8.9 0 0 1 8.7 6.6 1.5 1.5 0 0 1-1.46 1.85H4.76A1.5 1.5 0 0 1 3.3 20.2z" />
  </svg>
));
IconUser.displayName = 'IconUser';

/** Copa con asas y peana — récords y logros. */
export const IconTrophy = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path d="M6.4 2h11.2a1.2 1.2 0 0 1 1.2 1.2v1.1h2.6a1.2 1.2 0 0 1 1.19 1.35c-.36 2.86-1.99 5.08-4.73 5.79a6.6 6.6 0 0 1-3.66 3.1v2.06h2.3a1.2 1.2 0 0 1 1.2 1.2v1.1H6.3v-1.1a1.2 1.2 0 0 1 1.2-1.2h2.3v-2.06a6.6 6.6 0 0 1-3.66-3.1C3.4 10.74 1.77 8.52 1.41 5.66A1.2 1.2 0 0 1 2.6 4.3h2.6V3.2A1.2 1.2 0 0 1 6.4 2zM5.2 6.7H4.06c.32 1.2 1.02 2.07 2.06 2.55A8.4 8.4 0 0 1 5.2 6.7zm13.6 0a8.4 8.4 0 0 1-.92 2.55c1.04-.48 1.74-1.35 2.06-2.55z" />
    <rect x="6.3" y="20.4" width="11.4" height="2.2" rx="1.1" />
  </svg>
));
IconTrophy.displayName = 'IconTrophy';

/** Llama de dos lenguas — racha de días. */
export const IconFlame = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path d="M12.7 1.3c.5 2.5-.2 4.3-1.6 5.9-1.6 1.9-4.2 3.1-4.2 6.5a6.5 6.5 0 0 0 2.6 5.2c-.6-1.9.05-3.5 1.4-4.6.2 1.8 1.15 2.75 2.4 3.7 1.5 1.15 1.75 2.7 1.2 4.1a6.6 6.6 0 0 0 4-6.1c0-5.3-4.6-7.3-5.8-14.7z" />
  </svg>
));
IconFlame.displayName = 'IconFlame';

/** Calendario con el interior calado y tres marcas de día. */
export const IconCalendar = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7 1.4a1.2 1.2 0 0 1 1.2 1.2v1.2h7.6V2.6a1.2 1.2 0 1 1 2.4 0v1.2h1.3A2.6 2.6 0 0 1 22.1 6.4v13.6a2.6 2.6 0 0 1-2.6 2.6H4.5a2.6 2.6 0 0 1-2.6-2.6V6.4a2.6 2.6 0 0 1 2.6-2.6h1.3V2.6A1.2 1.2 0 0 1 7 1.4zM4.3 9.6v10.4c0 .11.09.2.2.2h15c.11 0 .2-.09.2-.2V9.6z"
    />
    <rect x="6.2" y="11.8" width="3" height="3" rx="1.1" />
    <rect x="10.5" y="11.8" width="3" height="3" rx="1.1" />
    <rect x="14.8" y="11.8" width="3" height="3" rx="1.1" />
  </svg>
));
IconCalendar.displayName = 'IconCalendar';

/** Tres barras ascendentes — estadísticas. */
export const IconChart = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <rect x="2.6" y="12.4" width="4.8" height="9" rx="1.8" />
    <rect x="9.6" y="7.2" width="4.8" height="14.2" rx="1.8" />
    <rect x="16.6" y="2.6" width="4.8" height="18.8" rx="1.8" />
  </svg>
));
IconChart.displayName = 'IconChart';

/**
 * Onda de pulso — el icono de cardio en la barra inferior.
 *
 * Única excepción al criterio de silueta rellena del set: una línea de
 * electrocardiograma no existe como mancha, solo como trazo. Se compensa con un
 * grosor alto (2.4) para que aguante los 20 px de la barra.
 */
export const IconPulse = memo(({ className }: GymIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
    focusable={false}
  >
    <path d="M2 12h3.6l2.2-6.4 3.4 12.8 2.6-8 1.8 4.2h6.4" />
  </svg>
));
IconPulse.displayName = 'IconPulse';

/** Tres barras — el menú de la cabecera. */
export const IconMenu = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <rect x="3" y="5.4" width="18" height="2.5" rx="1.25" />
    <rect x="3" y="10.75" width="18" height="2.5" rx="1.25" />
    <rect x="3" y="16.1" width="18" height="2.5" rx="1.25" />
  </svg>
));
IconMenu.displayName = 'IconMenu';

/** Libro abierto de dos hojas — la guía. */
export const IconBook = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path d="M1.9 5.3A1.3 1.3 0 0 1 3.2 4c2.7 0 5.8.55 7.6 2v14.7c-1.8-1.35-4.9-1.85-7.6-1.85a1.3 1.3 0 0 1-1.3-1.3z" />
    <path d="M22.1 5.3A1.3 1.3 0 0 0 20.8 4c-2.7 0-5.8.55-7.6 2v14.7c1.8-1.35 4.9-1.85 7.6-1.85a1.3 1.3 0 0 0 1.3-1.3z" />
  </svg>
));
IconBook.displayName = 'IconBook';

/** Regla hueca con sus marcas — medidas corporales. */
export const IconRuler = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.6 1.2h10.8a2.6 2.6 0 0 1 2.6 2.6v16.4a2.6 2.6 0 0 1-2.6 2.6H6.6A2.6 2.6 0 0 1 4 20.2V3.8a2.6 2.6 0 0 1 2.6-2.6zm.4 2.6a.8.8 0 0 0-.8.8v15.2c0 .44.36.8.8.8h10a.8.8 0 0 0 .8-.8V4.6a.8.8 0 0 0-.8-.8z"
    />
    <rect x="7.6" y="6.1" width="5.2" height="1.7" rx="0.85" />
    <rect x="7.6" y="10.1" width="3.3" height="1.7" rx="0.85" />
    <rect x="7.6" y="14.1" width="5.2" height="1.7" rx="0.85" />
    <rect x="7.6" y="18.1" width="3.3" height="1.7" rx="0.85" />
  </svg>
));
IconRuler.displayName = 'IconRuler';

/** Reloj de pulsera con correas — wearables. */
export const IconWatch = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <rect x="8.4" y="0.9" width="7.2" height="4.8" rx="1.8" />
    <rect x="8.4" y="18.3" width="7.2" height="4.8" rx="1.8" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 4.4h8a3.6 3.6 0 0 1 3.6 3.6v8a3.6 3.6 0 0 1-3.6 3.6H8A3.6 3.6 0 0 1 4.4 16V8A3.6 3.6 0 0 1 8 4.4zm4.9 4.3a1.1 1.1 0 0 0-2.2 0v3.5c0 .38.2.74.53.94l2.3 1.38a1.1 1.1 0 1 0 1.14-1.88l-1.77-1.07z"
    />
  </svg>
));
IconWatch.displayName = 'IconWatch';

/** Disco con la marca de verificación calada — guardado correcto. */
export const IconCheckBadge = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1.4a10.6 10.6 0 1 0 0 21.2 10.6 10.6 0 0 0 0-21.2zm5.06 7.79a1.35 1.35 0 0 0-2.02-1.79l-4.62 5.2-1.98-1.85a1.35 1.35 0 0 0-1.84 1.97l3 2.8a1.35 1.35 0 0 0 1.93-.09z"
    />
  </svg>
));
IconCheckBadge.displayName = 'IconCheckBadge';

/** Estrella maciza de cinco puntas — favoritos. */
export const IconStar = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path d="M12 1.8a1.2 1.2 0 0 1 1.08.67l2.62 5.32 5.87.86a1.2 1.2 0 0 1 .67 2.05l-4.25 4.14 1 5.85a1.2 1.2 0 0 1-1.74 1.26L12 19.2l-5.25 2.75a1.2 1.2 0 0 1-1.74-1.26l1-5.85-4.25-4.14a1.2 1.2 0 0 1 .67-2.05l5.87-.86 2.62-5.32A1.2 1.2 0 0 1 12 1.8z" />
  </svg>
));
IconStar.displayName = 'IconStar';

/**
 * Cerebro — lo que el entrenador ha aprendido de ti.
 *
 * Propio porque Reicon no trae ninguno, y los sustitutos que sí trae (Cpu,
 * Sparkle) ya significan otra cosa en esta app: Cpu es el propio entrenador y
 * Sparkle es "generado por IA". Reutilizar uno de los dos aquí haría que tres
 * conceptos distintos compartieran dibujo.
 */
export const IconBrain = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path d="M9.5 2A3.5 3.5 0 0 0 6 5.5v.12A3.5 3.5 0 0 0 3.5 9c0 .78.26 1.5.69 2.08A3.5 3.5 0 0 0 3 13.5c0 1.3.71 2.44 1.77 3.05A3.5 3.5 0 0 0 8 21.5c1.05 0 1.98-.46 2.62-1.19V3.9A3.49 3.49 0 0 0 9.5 2z" />
    <path d="M14.5 2c-.98 0-1.87.4-2.5 1.05v16.9c.63.65 1.52 1.05 2.5 1.05a3.5 3.5 0 0 0 3.48-3.15A3.51 3.51 0 0 0 20 14.8c0-.93-.36-1.77-.95-2.4A3.49 3.49 0 0 0 20.5 9.5a3.5 3.5 0 0 0-2.02-3.17V6.2A3.5 3.5 0 0 0 14.5 2z" />
  </svg>
));
IconBrain.displayName = 'IconBrain';

/** Símbolo de Marte (♂) — paso de sexo del onboarding. */
export const IconMale = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14.6 1.4a1.3 1.3 0 0 0 0 2.6h3.58l-4.13 4.13a7.9 7.9 0 1 0 1.84 1.84L20.02 5.86v3.58a1.3 1.3 0 1 0 2.6 0V2.7a1.3 1.3 0 0 0-1.3-1.3zM9.5 9.1a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6z"
    />
  </svg>
));
IconMale.displayName = 'IconMale';

/** Símbolo de Venus (♀) — paso de sexo del onboarding. */
export const IconFemale = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1.4a7.9 7.9 0 0 0-1.3 15.69v2.31H8.4a1.3 1.3 0 1 0 0 2.6h2.3v1a1.3 1.3 0 1 0 2.6 0v-1h2.3a1.3 1.3 0 1 0 0-2.6h-2.3v-2.31A7.9 7.9 0 0 0 12 1.4zm0 2.6a5.3 5.3 0 1 1 0 10.6A5.3 5.3 0 0 1 12 4z"
    />
  </svg>
));
IconFemale.displayName = 'IconFemale';

/** Cronómetro con pulsador — descanso entre series. */
export const IconTimer = memo(({ className }: GymIconProps) => (
  <svg {...svgProps(className)}>
    <rect x="9" y="0.9" width="6" height="2.6" rx="1.3" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 3.9a9.6 9.6 0 1 0 0 19.2 9.6 9.6 0 0 0 0-19.2zm1.3 4.9a1.3 1.3 0 0 0-2.6 0v4.4c0 .45.24.87.62 1.1l2.9 1.78a1.3 1.3 0 1 0 1.36-2.22l-2.28-1.4z"
    />
  </svg>
));
IconTimer.displayName = 'IconTimer';
