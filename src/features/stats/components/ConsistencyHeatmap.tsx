import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

interface DayData {
  date: string;
  volume: number;
  sessions: number;
}

interface ConsistencyHeatmapProps {
  data: DayData[];
}

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

export const ConsistencyHeatmap = memo(function ConsistencyHeatmap({
  data,
}: ConsistencyHeatmapProps) {
  const maxVolume = Math.max(...data.map((d) => d.volume), 1);

  const getIntensity = (volume: number): string => {
    if (volume === 0) return 'bg-[#1a1a1a]';
    const ratio = volume / maxVolume;
    if (ratio < 0.2) return 'bg-[#2d4a2d]';
    if (ratio < 0.4) return 'bg-[#3d6b3d]';
    if (ratio < 0.6) return 'bg-[#4d8c4d]';
    if (ratio < 0.8) return 'bg-[#6bad6b]';
    return 'bg-[#c8ff00]';
  };

  const getVolumeLabel = (volume: number): string => {
    if (volume === 0) return 'Sin entrenamiento';
    if (volume < 1000) return `${volume} kg`;
    return `${(volume / 1000).toFixed(1)}t`;
  };

  const { weeks, monthLabels } = useMemo(() => {
    const weeks: DayData[][] = [];
    const monthLabels: { month: string; startWeek: number }[] = [];
    let currentWeek: DayData[] = [];
    let lastMonth = -1;

    data.forEach((day, i) => {
      const date = new Date(day.date);
      const month = date.getMonth();

      if (month !== lastMonth && currentWeek.length > 0) {
        monthLabels.push({ month: MONTHS[month], startWeek: weeks.length });
        lastMonth = month;
      }

      const dayOfWeek = date.getDay();
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

    return { weeks, monthLabels };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] p-4">
        <div className="text-[0.8125rem] font-medium text-[var(--text-secondary)] mb-3">
          Consistencia
        </div>
        <div className="text-[0.75rem] text-[var(--text-tertiary)] text-center py-8">
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

      <div className="flex gap-1 mb-3">
        <div className="w-8"></div>
        {DAYS.map((day) => (
          <div
            key={day}
            className="flex-1 text-[0.625rem] text-center text-[var(--text-tertiary)] font-medium"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="relative">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {monthLabels.length > 0 && (
            <div className="absolute top-0 left-8 right-0 h-4 pointer-events-none">
              {monthLabels.map((m, i) => (
                <div
                  key={i}
                  className="absolute text-[0.5rem] text-[var(--text-tertiary)]"
                  style={{ left: `${m.startWeek * 20}px` }}
                >
                  {m.month}
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className={`w-4 h-4 rounded-[3px] transition-all hover:scale-110 cursor-pointer ${
                      day.volume > 0 ? getIntensity(day.volume) : 'bg-[#1a1a1a]'
                    }`}
                    title={
                      day.date
                        ? `${formatDate(day.date)}\n${getVolumeLabel(day.volume)}\n${day.sessions} sesión(es)`
                        : ''
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 mt-4">
        <span className="text-[0.5rem] text-[var(--text-tertiary)]">Menos</span>
        <div className="w-3 h-3 rounded-[3px] bg-[#1a1a1a]" />
        <div className="w-3 h-3 rounded-[3px] bg-[#2d4a2d]" />
        <div className="w-3 h-3 rounded-[3px] bg-[#3d6b3d]" />
        <div className="w-3 h-3 rounded-[3px] bg-[#4d8c4d]" />
        <div className="w-3 h-3 rounded-[3px] bg-[#6bad6b]" />
        <div className="w-3 h-3 rounded-[3px] bg-[#c8ff00]" />
        <span className="text-[0.5rem] text-[var(--text-tertiary)]">Más</span>
      </div>
    </motion.div>
  );
});
