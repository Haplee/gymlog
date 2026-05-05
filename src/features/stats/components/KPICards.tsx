import { memo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon:
    | 'flame'
    | 'volume'
    | 'frequency'
    | 'prs'
    | 'duration'
    | 'cardio-sessions'
    | 'cardio-time'
    | 'cardio-dist';
  trend?: number;
  isNewPR?: boolean;
  accentColor?: string;
}

const svgProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const iconDefs: Record<string, { el: React.ReactElement; color: string }> = {
  flame: {
    color: '#fb923c',
    el: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" {...svgProps}>
        <path d="M12 2c0 6-6 7-6 12a6 6 0 0 0 12 0c0-5-6-6-6-12z" />
        <path d="M12 12c0 3-2 4-2 6a2 2 0 0 0 4 0c0-2-2-3-2-6z" />
      </svg>
    ),
  },
  volume: {
    color: '#34d399',
    el: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" {...svgProps}>
        <polyline points="3,17 8,12 13,15 21,7" />
        <polyline points="15,7 21,7 21,13" />
      </svg>
    ),
  },
  frequency: {
    color: '#60a5fa',
    el: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" {...svgProps}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  prs: {
    color: '#fbbf24',
    el: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" {...svgProps}>
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
      </svg>
    ),
  },
  duration: {
    color: '#e879f9',
    el: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" {...svgProps}>
        <circle cx="12" cy="12" r="9" />
        <polyline points="12,7 12,12 15.5,14.5" />
      </svg>
    ),
  },
  'cardio-sessions': {
    color: '#38bdf8',
    el: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" {...svgProps}>
        <path d="M13 4.5L10 9l2.5 1.5-2.5 6" />
        <path d="M13 4.5l3.5-1 1.5 3.5" />
        <circle cx="14" cy="3" r="1.5" />
        <path d="M10 9l-3-1.5 1.5-3.5" />
      </svg>
    ),
  },
  'cardio-time': {
    color: '#a78bfa',
    el: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" {...svgProps}>
        <polyline points="2,12 5,12 7.5,5 10.5,19 13.5,8 16,15 18,12 22,12" />
      </svg>
    ),
  },
  'cardio-dist': {
    color: '#f472b6',
    el: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" {...svgProps}>
        <path d="M3 12h18" />
        <path d="M3 6l9-4 9 4" />
        <path d="M3 18l9 4 9-4" />
      </svg>
    ),
  },
};

export const KPICard = memo(function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  isNewPR,
  accentColor,
}: KPICardProps) {
  const def = iconDefs[icon] ?? iconDefs.duration;
  const color = accentColor ?? def.color;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="relative overflow-hidden rounded-[var(--radius-xl)] p-4"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      {/* Left accent bar */}
      <div
        className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-[var(--radius-xl)]"
        style={{ backgroundColor: color }}
      />

      <div className="pl-2">
        {/* Icon + label row */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[0.625rem] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {title}
          </span>
          <span style={{ color }}>{def.el}</span>
        </div>

        {/* Value */}
        <motion.div
          className="font-mono font-bold leading-none tracking-tight"
          style={{
            fontSize: '2.25rem',
            color: 'var(--text-primary)',
          }}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
        >
          {value}
        </motion.div>

        {/* Subtitle + badges */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {subtitle && (
            <span className="text-[0.6875rem]" style={{ color: 'var(--text-tertiary)' }}>
              {subtitle}
            </span>
          )}
          {trend !== undefined && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-[0.625rem] font-semibold px-1.5 py-0.5 rounded-[var(--radius-pill)] flex items-center gap-0.5"
              style={{
                backgroundColor: trend >= 0 ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)',
                color: trend >= 0 ? 'var(--success)' : 'var(--error)',
              }}
            >
              {trend >= 0 ? (
                <TrendingUp className="w-2.5 h-2.5" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5" />
              )}
              {Math.abs(trend)}%
            </motion.span>
          )}
          {isNewPR && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[0.5625rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[var(--radius-pill)]"
              style={{
                backgroundColor: 'rgba(48,209,88,0.15)',
                color: 'var(--success)',
              }}
            >
              Nuevo
            </motion.span>
          )}
        </div>
      </div>
    </motion.div>
  );
});
