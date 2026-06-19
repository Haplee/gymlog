import { m } from 'framer-motion';
import { Target } from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CHART_COLORS } from '../../constants';
import { SectionLabel } from './SectionLabel';

export interface MuscleDistributionItem {
  name: string;
  value: number;
}

export function MuscleDistributionChart({ data }: { data: MuscleDistributionItem[] }) {
  const totalVol = data.reduce((s, m) => s + m.value, 0);

  return (
    <section className="space-y-3">
      <SectionLabel>Balance muscular</SectionLabel>
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="rounded-card p-4 bg-surface"
      >
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-fg-muted">Distribución por grupo muscular</span>
        </div>

        {/* Pie chart */}
        <div className="h-[140px] mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={60}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface-3)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 10,
                  fontSize: 12,
                }}
                formatter={(v) => {
                  const n = Number(v);
                  return [
                    totalVol > 0
                      ? `${(n / 1000).toFixed(1)}t (${Math.round((n / totalVol) * 100)}%)`
                      : `${v}`,
                    'Volumen',
                  ];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Horizontal bars */}
        <div className="space-y-2">
          {data.slice(0, 6).map(({ name, value }, i) => {
            const pct = totalVol > 0 ? Math.round((value / totalVol) * 100) : 0;
            return (
              <div key={name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="text-sm text-fg-muted">{name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-fg-subtle">
                      {(value / 1000).toFixed(1)}t
                    </span>
                    <span
                      className="text-2xs font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${CHART_COLORS[i % CHART_COLORS.length]}20`,
                        color: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-surface-2">
                  <m.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </m.div>
    </section>
  );
}
