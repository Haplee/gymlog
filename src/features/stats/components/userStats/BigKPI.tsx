import { m } from 'framer-motion';

export function BigKPI({
  value,
  label,
  icon: Icon,
  color = 'var(--interactive-primary)',
  delay = 0,
}: {
  value: string | number;
  label: string;
  icon: React.ElementType;
  color?: string;
  delay?: number;
}) {
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      className="relative overflow-hidden rounded-card p-4 flex flex-col gap-2 bg-surface border border-line shadow-card"
    >
      {/* Tinte del color del KPI en el borde superior */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-14 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, color-mix(in srgb, ${color} 8%, transparent), transparent)`,
        }}
      />
      <div
        className="relative w-8 h-8 rounded-md flex items-center justify-center"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="relative font-mono font-bold text-2xl leading-none text-fg tabular-nums">
        {value}
      </div>
      <div className="relative text-xs text-fg-subtle">{label}</div>
    </m.div>
  );
}
