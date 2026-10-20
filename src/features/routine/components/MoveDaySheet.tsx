import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@shared/components/ui';
import type { DayOfWeek, DayRoutine } from '@features/routine/stores/routineStore';

interface MoveDaySheetProps {
  open: boolean;
  /** Día del calendario que se está moviendo; se omite de la lista de destinos. */
  selectedDay: DayOfWeek;
  /** Nombre del día de la rutina que se mueve, solo para el título. */
  dayName: string;
  days: readonly DayOfWeek[];
  /** Resuelve el contenido que hoy tiene cada día del calendario. */
  getRoutineDay: (day: DayOfWeek) => DayRoutine | null;
  onMove: (to: DayOfWeek) => void;
  onClose: () => void;
}

/**
 * Elegir a qué día de esta semana se mueve el entreno visible.
 *
 * La rutina no se toca: lo que cambia es el plan de la semana, que caduca solo
 * el lunes.
 */
export function MoveDaySheet({
  open,
  selectedDay,
  dayName,
  days,
  getRoutineDay,
  onMove,
  onClose,
}: MoveDaySheetProps) {
  const { t } = useTranslation();

  return (
    <BottomSheet open={open} onClose={onClose} title={t('routine.move_title', { name: dayName })}>
      <div className="flex flex-col gap-2 pb-2">
        <p className="text-xs text-fg-subtle">{t('routine.move_help')}</p>
        {days
          .filter((day) => day !== selectedDay)
          .map((day) => {
            const target = getRoutineDay(day);
            const busy = (target?.exercises.length ?? 0) > 0;
            return (
              <button
                key={day}
                type="button"
                onClick={() => onMove(day)}
                className="w-full min-h-12 px-3 py-2 rounded-md flex items-center justify-between gap-3 text-left bg-surface-2 border border-line active:scale-[0.99] transition-transform"
              >
                <span className="text-sm font-medium text-fg">{t(`routine.days.${day}`)}</span>
                <span className="text-xs truncate text-fg-subtle">
                  {busy ? target?.name : t('routine.move_free')}
                </span>
              </button>
            );
          })}
      </div>
    </BottomSheet>
  );
}
