import { memo } from 'react';
import { motion } from 'framer-motion';

interface DayData {
  date: string;
  volume: number;
  sessions: number;
}

interface ConsistencyHeatmapProps {
  data: DayData[];
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const ConsistencyHeatmap = memo(function ConsistencyHeatmap({
  data,
}: ConsistencyHeatmapProps) {
  const maxVolume = Math.max(...data.map((d) => d.volume), 1);

  const getIntensity = (volume: number): string => {
    if (volume === 0) return 'bg-[var(--bg-surface-3)]';
    const ratio = volume / maxVolume;
    if (ratio < 0.25) return 'bg-[#3A3A3A]';
    if (ratio < 0.5) return 'bg-[#6A6A6A]';
    if (ratio < 0.75) return 'bg-[#A0A0A0]';
    return 'bg-[var(--interactive-primary)]';
  };

  const weeks: DayData[][] = [];
  let currentWeek: DayData[] = [];

  data.forEach((day, i) => {
    const dayOfWeek = new Date(day.date).getDay();
    const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    while (currentWeek.length < adjustedDay) {
      currentWeek.push({ date: '', volume: 0, sessions: 0 });
    }
    currentWeek.push(day);

    if (adjustedDay === 6 || i === data.length - 1) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: '', volume: 0, sessions: 0 });
      }
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  if (data.length === 0) {
    return (
      <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] p-4">
        <div className="text-[0.8125rem] font-medium text-[var(--text-tertiary)] text-center py-8">
          Sin datos de entrenamiento
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] p-4"
    >
      <div className="text-[0.8125rem] font-medium mb-3 text-[var(--text-secondary)]">
        Consistencia
      </div>
      <div className="flex gap-1 mb-2">
        <div className="w-6"></div>
        {DAYS.map((day) => (
          <div key={day} className="flex-1 text-[0.5rem] text-center text-[var(--text-tertiary)]">
            {day}
          </div>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => (
              <div
                key={di}
                className={`w-3 h-3 rounded-[2px] ${day.volume > 0 ? getIntensity(day.volume) : 'bg-[var(--bg-surface-3)]'}`}
                title={day.date ? `${day.date}: ${day.volume.toLocaleString()} kg` : ''}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1 mt-2">
        <span className="text-[0.5rem] text-[var(--text-tertiary)]">Menos</span>
        <div className="w-3 h-3 rounded-[2px] bg-[var(--bg-surface-3)]" />
        <div className="w-3 h-3 rounded-[2px] bg-[#3A3A3A]" />
        <div className="w-3 h-3 rounded-[2px] bg-[#6A6A6A]" />
        <div className="w-3 h-3 rounded-[2px] bg-[#A0A0A0]" />
        <div className="w-3 h-3 rounded-[2px] bg-[var(--interactive-primary)]" />
        <span className="text-[0.5rem] text-[var(--text-tertiary)]">Más</span>
      </div>
    </motion.div>
  );
});
