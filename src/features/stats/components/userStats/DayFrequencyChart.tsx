import { m } from 'framer-motion';
import { Zap } from 'lucide-react';
import { SectionLabel } from './SectionLabel';

export interface DayFrequencyItem {
  day: string;
  count: number;
  pct: number;
}

export function DayFrequencyChart({
  data,
  bestDay,
}: {
  data: DayFrequencyItem[];
  bestDay: string | null;
}) {
  return (
    <section className="space-y-3">
      <SectionLabel>Consistencia por día</SectionLabel>
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-card p-4 bg-surface"
      >
        {bestDay && (
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4" style={{ color: '#fbbf24' }} />
            <span className="text-sm font-medium text-fg-muted">
              Tu día favorito: <span className="font-bold text-fg">{bestDay}</span>
            </span>
          </div>
        )}
        <div className="space-y-2.5">
          {data.map(({ day, count, pct }, i) => (
            <div key={day}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm w-8 text-fg-muted">{day}</span>
                <div className="flex-1 mx-3 h-2 rounded-full overflow-hidden bg-surface-2">
                  <m.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.45 + i * 0.04, duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: pct === 100 ? '#c8ff00' : pct > 60 ? '#22c55e' : '#3b82f6',
                    }}
                  />
                </div>
                <span className="text-xs font-mono w-6 text-right text-fg-subtle">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </m.div>
    </section>
  );
}
