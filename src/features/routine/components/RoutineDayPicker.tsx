import { useTranslation } from 'react-i18next';
import { Chip } from '@shared/components/ui';
import type { DayOfWeek } from '@features/routine/stores/routineStore';

interface RoutineDayPickerProps {
  days: readonly DayOfWeek[];
  selectedDay: DayOfWeek;
  /** Día de la rutina mostrado en cada día del calendario, o null sin reorganizar. */
  planMap: Record<DayOfWeek, DayOfWeek | null> | null;
  onSelect: (day: DayOfWeek) => void;
}

/**
 * Barra L-D de la rutina.
 *
 * Un punto marca los días que esta semana no llevan lo suyo: sin él, la barra
 * se ve igual con la semana movida y sin mover, y no había forma de saber que
 * el martes estaba enseñando el lunes.
 */
export function RoutineDayPicker({ days, selectedDay, planMap, onSelect }: RoutineDayPickerProps) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
      {days.map((day) => {
        const shifted = planMap != null && planMap[day] !== day;
        return (
          <Chip
            key={day}
            variant="day"
            selected={selectedDay === day}
            onClick={() => onSelect(day)}
            className="relative"
          >
            {t(`routine.days.${day}`).slice(0, 3)}
            {shifted && (
              <span
                aria-hidden
                className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-pill ${
                  selectedDay === day ? 'bg-accent-fg' : 'bg-accent'
                }`}
              />
            )}
          </Chip>
        );
      })}
    </div>
  );
}
