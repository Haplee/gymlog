/**
 * Punto ÚNICO de import de iconos de la app.
 *
 * Ningún componente importa de 'reicon-react' directamente: todos importan de
 * aquí. Así, cambiar de librería (o vendorizar los SVG si algún día hiciera
 * falta) es tocar este fichero y no los 68 que usan iconos.
 *
 * Dos familias conviven a propósito:
 *  · Icon*  — SVG propios de dominio (máquinas, equipamiento, ♂/♀). Ninguna
 *             librería generalista los cubre; se mantienen y se re-dibujan al
 *             grid 24x24 / trazo 1.5px de Reicon para que sean de la misma familia.
 *  · resto  — Reicon. Outline por defecto; Filled (prop `weight`) solo para
 *             estado activo, seleccionado o destacado. 24px estándar, 20px en
 *             chips y filas densas.
 */

// ── Reicon ──────────────────────────────────────────
export type { IconProps, IconWeight, IconComponent } from 'reicon-react';

export {
  // Navegación y controles
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Xmark,
  Plus,
  Minus,
  Check,
  // Datos y progreso
  TrendUp,
  TrendDown,
  ChartBar,
  Target,
  Fire,
  // Acciones
  Trash,
  Edit,
  Download,
  Upload,
  Share,
  // Entrenamiento
  Dumbbell,
  HeartPulse,
  Timer,
  // Estado y feedback
  AlertTriangle,
  InfoCircle,
  Sparkle,
  Loader,
} from 'reicon-react';

// ── SVG propios de dominio ──────────────────────────
export {
  IconHome,
  IconDumbbell,
  IconShoe,
  IconHistory,
  IconGear,
  IconSearch,
  IconUser,
  IconTrophy,
  IconFlame,
  IconCalendar,
  IconChart,
  IconPulse,
  IconMenu,
  IconBook,
  IconRuler,
  IconWatch,
  IconCheckBadge,
  IconTimer,
  IconStar,
  IconMale,
  IconFemale,
} from './GymIcons';
export type { GymIconProps } from './GymIcons';
