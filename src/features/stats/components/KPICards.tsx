import { motion } from 'framer-motion';
import { Flame, TrendingUp, TrendingDown, Calendar, Trophy } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: 'flame' | 'volume' | 'frequency' | 'prs';
  trend?: number;
  isNewPR?: boolean;
}

export function KPICard({ title, value, subtitle, icon, trend, isNewPR }: KPICardProps) {
  const icons = {
    flame: <Flame className="w-4 h-4" />,
    volume: <TrendingUp className="w-4 h-4" />,
    frequency: <Calendar className="w-4 h-4" />,
    prs: <Trophy className="w-4 h-4" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.6875rem] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
          {title}
        </span>
        <span className="text-[var(--text-tertiary)]">{icons[icon]}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-[2rem] font-semibold text-[var(--text-primary)] font-mono">
          {value}
        </span>
        {trend !== undefined && (
          <span
            className={`text-[0.75rem] font-medium mb-1 ${trend >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}
          >
            {trend >= 0 ? (
              <TrendingUp className="w-3 h-3 inline" />
            ) : (
              <TrendingDown className="w-3 h-3 inline" />
            )}{' '}
            {Math.abs(trend)}%
          </span>
        )}
        {isNewPR && (
          <span className="text-[0.6875rem] font-medium text-[var(--success)] bg-[var(--success)]/20 px-2 py-0.5 rounded-[var(--radius-pill)]">
            NUEVO
          </span>
        )}
      </div>
      {subtitle && <span className="text-[0.6875rem] text-[var(--text-tertiary)]">{subtitle}</span>}
    </motion.div>
  );
}
