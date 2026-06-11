import { motion } from 'framer-motion';
import { CHART_COLORS } from '../../constants';
import { SectionLabel } from './SectionLabel';

export interface TopExerciseItem {
  name: string;
  volume: number;
  sets: number;
  best1rm: number;
}

export function TopExercisesList({ data }: { data: TopExerciseItem[] }) {
  return (
    <section className="space-y-3">
      <SectionLabel>Top ejercicios por volumen</SectionLabel>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="rounded-[var(--radius-xl)] overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {data.map((ex, i) => {
          const maxVol = data[0].volume;
          const pct = Math.round((ex.volume / maxVol) * 100);
          return (
            <div
              key={ex.name}
              className="px-4 py-3"
              style={{
                borderBottom: i < data.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[0.625rem] font-bold flex-shrink-0"
                    style={{
                      backgroundColor:
                        i === 0
                          ? '#fbbf24'
                          : i === 1
                            ? '#a3a3a3'
                            : i === 2
                              ? '#92400e'
                              : 'var(--bg-surface-2)',
                      color: i < 3 ? '#000' : 'var(--text-tertiary)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="text-[0.875rem] font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {ex.name}
                  </span>
                </div>
                <div className="text-right">
                  <div
                    className="text-[0.8125rem] font-semibold font-mono"
                    style={{ color: 'var(--interactive-primary)' }}
                  >
                    {(ex.volume / 1000).toFixed(1)}t
                  </div>
                  <div className="text-[0.625rem]" style={{ color: 'var(--text-tertiary)' }}>
                    {ex.sets} series · 1RM ~{ex.best1rm.toFixed(0)}kg
                  </div>
                </div>
              </div>
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--bg-surface-2)' }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.55 + i * 0.05, duration: 0.5 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
              </div>
            </div>
          );
        })}
      </motion.div>
    </section>
  );
}
