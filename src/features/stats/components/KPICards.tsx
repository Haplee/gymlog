import { memo } from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, TrendingDown, Calendar, Trophy, Clock } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: 'flame' | 'volume' | 'frequency' | 'prs' | 'duration';
  trend?: number;
  isNewPR?: boolean;
}

const iconBgColors: Record<string, string> = {
  flame: 'bg-orange-500/20',
  volume: 'bg-emerald-500/20',
  frequency: 'bg-blue-500/20',
  prs: 'bg-yellow-500/20',
  duration: 'bg-pink-500/20',
};

const iconColors: Record<string, string> = {
  flame: 'text-orange-400',
  volume: 'text-emerald-400',
  frequency: 'text-blue-400',
  prs: 'text-yellow-400',
  duration: 'text-pink-400',
};

export const KPICard = memo(function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  isNewPR,
}: KPICardProps) {
  const icons = {
    flame: <Flame className="w-5 h-5" />,
    volume: <TrendingUp className="w-5 h-5" />,
    frequency: <Calendar className="w-5 h-5" />,
    prs: <Trophy className="w-5 h-5" />,
    duration: <Clock className="w-5 h-5" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-4 relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[0.6875rem] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-[var(--radius-md)] ${iconBgColors[icon]}`}>
          <span className={iconColors[icon]}>{icons[icon]}</span>
        </div>
      </div>

      <div className="flex items-end gap-2 mb-1">
        <motion.span
          className="text-[2.25rem] font-bold text-[var(--text-primary)] font-mono tracking-tight"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {value}
        </motion.span>
        {trend !== undefined && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`text-[0.6875rem] font-semibold px-2 py-0.5 rounded-[var(--radius-pill)] flex items-center gap-1 mb-1 ${
              trend >= 0
                ? 'bg-[var(--success)]/20 text-[var(--success)]'
                : 'bg-[var(--error)]/20 text-[var(--error)]'
            }`}
          >
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </motion.span>
        )}
        {isNewPR && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-[0.625rem] font-bold text-[var(--success)] bg-[var(--success)]/20 px-2 py-0.5 rounded-[var(--radius-pill)] uppercase mb-1"
          >
            NUEVO
          </motion.span>
        )}
      </div>
      {subtitle && <span className="text-[0.6875rem] text-[var(--text-tertiary)]">{subtitle}</span>}
    </motion.div>
  );
});
