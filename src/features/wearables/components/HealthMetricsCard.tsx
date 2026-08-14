import { useTranslation } from 'react-i18next';
import type { WearableDaily, WearableSleep } from '../types';
import {
  ChevronRight,
  Flame,
  Heart,
  HeartPulse,
  Moon,
  Route,
  Walk,
} from '@shared/components/icons';

function fmtMinutes(min: number | null | undefined): string {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface HealthMetricsCardProps {
  daily?: WearableDaily;
  sleep?: WearableSleep;
  /** Si se pasa, la tarjeta es pulsable (p. ej. navegar a /wearables). */
  onOpen?: () => void;
}

/**
 * Resumen glanceable del último día de wearable: expone TODAS las métricas
 * capturadas (antes solo se veían 3). Cada tile se oculta si no hay dato, así
 * la rejilla se adapta a lo que el wearable realmente escribe.
 */
export function HealthMetricsCard({ daily, sleep, onOpen }: HealthMetricsCardProps) {
  const { t, i18n } = useTranslation();

  const num = (v: number | null | undefined) =>
    v != null ? v.toLocaleString(i18n.language) : null;

  const hr =
    daily?.avg_hr != null
      ? `${daily.avg_hr}${daily.max_hr != null ? ` / ${daily.max_hr}` : ''}`
      : null;

  // El día mostrado no siempre es hoy: de madrugada, el día en curso aún no
  // tiene pulsaciones y se enseña el último con datos reales. Sin esta etiqueta
  // el usuario leería el dato de ayer como si fuera de hoy.
  const dayLabel = daily?.date && !isToday(daily.date) ? formatDayLabel(daily.date) : null;

  const tiles = [
    { icon: <Walk size={18} />, label: t('wearables.steps'), value: num(daily?.steps) },
    {
      icon: <Moon size={18} />,
      label: t('wearables.sleep'),
      value: fmtMinutesOrNull(sleep?.duration_min),
    },
    {
      icon: <HeartPulse size={18} />,
      label: t('wearables.resting_hr'),
      value: daily?.resting_hr != null ? `${daily.resting_hr}` : null,
    },
    {
      icon: <Route size={18} />,
      label: t('wearables.distance'),
      value: daily?.distance_km != null ? `${daily.distance_km.toFixed(1)} km` : null,
    },
    { icon: <Flame size={18} />, label: t('wearables.calories'), value: num(daily?.calories) },
    { icon: <Heart size={18} />, label: t('wearables.hr_avg_max'), value: hr },
  ].filter((tile) => tile.value != null);

  const inner = (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="label-caps text-fg-subtle">{t('wearables.title')}</span>
        <div className="flex items-center gap-2">
          {dayLabel && <span className="text-xs text-fg-subtle">{dayLabel}</span>}
          {onOpen && <ChevronRight size={16} className="text-fg-subtle" aria-hidden="true" />}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col items-center gap-1 text-center">
            <div className="text-accent">{tile.icon}</div>
            <div className="font-mono text-lg text-fg">{tile.value}</div>
            <div className="text-xs text-fg-subtle">{tile.label}</div>
          </div>
        ))}
      </div>
    </>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-card border border-line-strong bg-surface p-4 text-left shadow-card scale-in transition-colors active:bg-hover"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="rounded-card border border-line-strong bg-surface p-4 shadow-card scale-in">
      {inner}
    </div>
  );
}

function fmtMinutesOrNull(min: number | null | undefined): string | null {
  if (!min || min <= 0) return null;
  return fmtMinutes(min);
}

/** `date` es YYYY-MM-DD en hora local: se compara como string, sin Date. */
function isToday(date: string): boolean {
  const now = new Date();
  const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return date === local;
}

function formatDayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}
