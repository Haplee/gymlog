import { Button } from '@/shared/components/ui';

interface ConnectionCardProps {
  title: string;
  description: string;
  connected: boolean;
  statusLabel: string;
  lastSyncLabel?: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  busy?: boolean;
  icon: React.ReactNode;
  hint?: string;
}

/** Tarjeta de estado de una fuente de datos (Fitbit, agregador de salud, …). */
export function ConnectionCard({
  title,
  description,
  connected,
  statusLabel,
  lastSyncLabel,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  busy,
  icon,
  hint,
}: ConnectionCardProps) {
  return (
    <div className="rounded-2xl p-4 scale-in bg-surface border border-line-strong shadow-card">
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-accent mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-base text-fg">{title}</div>
            <span
              className={`text-xs px-2 py-0.5 rounded-pill ${
                connected ? 'bg-accent/15 text-accent' : 'bg-surface-3 text-fg-subtle'
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <div className="text-xs text-fg-subtle mt-0.5">{description}</div>
          {lastSyncLabel && <div className="text-xs text-fg-subtle mt-1">{lastSyncLabel}</div>}
          {hint && <div className="text-xs text-fg-subtle mt-2 leading-relaxed">{hint}</div>}

          <div className="flex flex-col gap-2 mt-3">
            <Button
              variant="primary"
              onClick={onPrimary}
              disabled={busy}
              className="w-full whitespace-nowrap"
            >
              {primaryLabel}
            </Button>
            {secondaryLabel && onSecondary && (
              <Button
                variant="secondary"
                onClick={onSecondary}
                disabled={busy}
                className="w-full whitespace-nowrap"
              >
                {secondaryLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
