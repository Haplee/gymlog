import { useTranslation } from 'react-i18next';
import { Moon, Footprints, HeartPulse } from 'lucide-react';
import type { WearableDaily, WearableSleep } from '../types';

function fmtMinutes(min: number | null | undefined): string {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface SleepCardProps {
  sleep?: WearableSleep;
  daily?: WearableDaily;
}

/** Resumen del último dato: sueño + pasos + FC en reposo. */
export function SleepCard({ sleep, daily }: SleepCardProps) {
  const { t } = useTranslation();
  const { i18n } = useTranslation();

  return (
    <div className="rounded-2xl p-4 scale-in bg-surface border border-line-strong shadow-card">
      <div className="grid grid-cols-3 gap-3">
        <Metric
          icon={<Moon size={18} />}
          label={t('wearables.sleep')}
          value={fmtMinutes(sleep?.duration_min)}
        />
        <Metric
          icon={<Footprints size={18} />}
          label={t('wearables.steps')}
          value={daily?.steps != null ? daily.steps.toLocaleString(i18n.language) : '—'}
        />
        <Metric
          icon={<HeartPulse size={18} />}
          label={t('wearables.resting_hr')}
          value={daily?.resting_hr != null ? `${daily.resting_hr} ${t('wearables.bpm')}` : '—'}
        />
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-1">
      <div className="text-accent">{icon}</div>
      <div className="text-lg font-mono text-fg">{value}</div>
      <div className="text-xs text-fg-subtle">{label}</div>
    </div>
  );
}
