import { m } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import type { Tip } from '@features/stats/utils/tips';

export function TipCard({ tip, index }: { tip: Tip; index: number }) {
  const config = {
    warning: {
      icon: AlertTriangle,
      color: 'var(--warning)',
      bg: 'color-mix(in srgb, var(--warning) 8%, transparent)',
      border: 'color-mix(in srgb, var(--warning) 20%, transparent)',
    },
    success: {
      icon: CheckCircle2,
      color: 'var(--success)',
      bg: 'color-mix(in srgb, var(--success) 8%, transparent)',
      border: 'color-mix(in srgb, var(--success) 20%, transparent)',
    },
    info: {
      icon: Lightbulb,
      color: 'var(--interactive-primary)',
      bg: 'color-mix(in srgb, var(--interactive-primary) 8%, transparent)',
      border: 'color-mix(in srgb, var(--interactive-primary) 15%, transparent)',
    },
    danger: {
      icon: AlertTriangle,
      color: 'var(--error)',
      bg: 'color-mix(in srgb, var(--error) 8%, transparent)',
      border: 'color-mix(in srgb, var(--error) 20%, transparent)',
    },
  }[tip.type];
  const Icon = config.icon;

  return (
    <m.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, type: 'spring', stiffness: 280, damping: 22 }}
      className="flex gap-3 p-3.5 rounded-card"
      style={{ backgroundColor: config.bg, border: `1px solid ${config.border}` }}
    >
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: config.color }} />
      <div>
        <div className="text-sm font-semibold mb-0.5 text-fg">{tip.title}</div>
        <div className="text-xs leading-relaxed text-fg-muted">{tip.message}</div>
      </div>
    </m.div>
  );
}
