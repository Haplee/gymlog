import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { SectionLabel } from './SectionLabel';

export interface WeeklyVolumePoint {
  week: string;
  vol: number;
  label: string;
}

export function WeeklyVolumeChart({
  data,
  volumeChange,
}: {
  data: WeeklyVolumePoint[];
  volumeChange: number;
}) {
  return (
    <section className="space-y-3">
      <SectionLabel>Evolución del volumen</SectionLabel>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-[var(--radius-xl)] p-4"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--interactive-primary)' }} />
            <span
              className="text-[0.8125rem] font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Últimas 8 semanas
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {volumeChange > 0 ? (
              <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--error)' }} />
            )}
            <span
              className="text-[0.75rem] font-semibold font-mono"
              style={{ color: volumeChange >= 0 ? 'var(--success)' : 'var(--error)' }}
            >
              {volumeChange > 0 ? '+' : ''}
              {volumeChange}%
            </span>
          </div>
        </div>
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="userStatsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c8ff00" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#c8ff00" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={[0, 'dataMax + 10']} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface-3)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 10,
                  fontSize: 12,
                }}
                formatter={(v) => {
                  const n = Number(v);
                  return [n > 0 ? `${(n / 1000).toFixed(1)}t` : '0', 'Volumen'];
                }}
              />
              <Area
                type="monotone"
                dataKey="vol"
                stroke="#c8ff00"
                strokeWidth={2.5}
                fill="url(#userStatsGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </section>
  );
}
