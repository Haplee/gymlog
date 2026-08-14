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
 *
 * Se re-exportan con el nombre REAL de Reicon, no con el que tenían en lucide.
 * Mantener alias tipo `TrendUp as TrendingUp` habría hecho el barrido más
 * barato, pero dejaría la app hablando el vocabulario de una librería que ya
 * no está instalada.
 */

// ── Reicon ──────────────────────────────────────────
export type { IconProps, IconWeight, IconComponent } from 'reicon-react';

export {
  // Navegación y controles
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ArrowLeft,
  Xmark,
  X,
  XCircle,
  Plus,
  Minus,
  Check,
  CheckCircle,
  CheckSquare,
  Menu,
  Search,
  // Datos y progreso
  TrendUp,
  TrendDown,
  ChartBar,
  Target,
  Fire,
  Flame,
  Activity,
  Trophy,
  Medal,
  Star,
  Calculator,
  Scale,
  Weight,
  Route,
  // Acciones
  Trash,
  Trash2,
  Edit,
  Download,
  Upload,
  Share,
  Send,
  Repeat,
  Refresh,
  Undo,
  Copy,
  CopySuccess,
  Camera,
  Logout,
  Play,
  Pause,
  Stop,
  Bookmark,
  BookmarkAdd,
  // Entrenamiento y salud
  Dumbbell,
  HeartPulse,
  Heart,
  Timer,
  Clock,
  AlarmClock,
  Stethoscope,
  Bicycle,
  Run,
  Walk,
  Swimming,
  Ship,
  Backpack,
  Coffee,
  Man,
  Moon,
  // Estado y feedback
  AlertTriangle,
  AlertCircle,
  InfoCircle,
  Sparkle,
  Sparkles,
  Lightbulb,
  Flash,
  Loader,
  // Contenido
  BookOpen,
  Calendar,
  History,
  Stickynote,
  FileContent,
  DocumentCode,
  Database,
  Server,
  Cpu,
  Fingerprint,
  // Conectividad
  WifiOff,
  Cloud,
  CloudCross,
  // Formularios
  Eye,
  EyeOff,
  // Avisos
  Bell,
  BellRing,
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
  IconBrain,
  IconMale,
  IconFemale,
} from './GymIcons';
export type { GymIconProps } from './GymIcons';
