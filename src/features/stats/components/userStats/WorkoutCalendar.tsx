import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  isSameMonth,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { toLocalDateKey } from '@shared/lib/dateKeys';
import type { WorkoutWithSets } from '@shared/lib/types';
import { ChevronLeft, ChevronRight } from '@shared/components/icons';

interface WorkoutCalendarProps {
  workouts: WorkoutWithSets[];
}

/** Lunes primero, como el resto de la app. */
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/**
 * Calendario "Workout Log" del kit FitBody: cabecera de días en píldoras de
 * acento sobre una tarjeta clara, y el día entrenado marcado con un círculo
 * relleno del acento. Muestra de un vistazo la constancia del mes.
 */
export function WorkoutCalendar({ workouts }: WorkoutCalendarProps) {
  const { t, i18n } = useTranslation();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const trained = useMemo(() => {
    const keys = new Set<string>();
    for (const w of workouts) {
      if (!w.started_at) continue;
      const d = new Date(w.started_at);
      if (!isNaN(d.getTime())) keys.add(toLocalDateKey(d));
    }
    return keys;
  }, [workouts]);

  // La rejilla arranca en el lunes de la semana del día 1 y termina en el
  // domingo de la semana del último día, para no dejar filas incompletas.
  const days = useMemo(() => {
    const first = startOfMonth(month);
    const last = endOfMonth(month);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const end = new Date(last);
    end.setDate(last.getDate() + ((7 - last.getDay()) % 7));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const todayKey = toLocalDateKey(new Date());
  // El idioma lo manda la app, no el del dispositivo: con el móvil en inglés
  // y GymLog en español el mes salía como "July 2026".
  const monthLabel = month.toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  });
  const trainedThisMonth = days.filter(
    (d) => isSameMonth(d, month) && trained.has(toLocalDateKey(d)),
  ).length;

  return (
    <div className="rounded-card bg-surface border border-line p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMonth(subMonths(month, 1))}
          aria-label={t('common.back')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-fg-muted active:opacity-70"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          {/* first-letter, no `capitalize`: en español es "Julio de 2026", y
              `capitalize` pone mayúscula en cada palabra ("Julio De 2026"). */}
          <div className="font-display text-sm font-bold text-fg first-letter:uppercase">
            {monthLabel}
          </div>
          <div className="text-2xs text-fg-subtle">
            {trainedThisMonth === 1
              ? t('userStats.calendar_trained_one')
              : t('userStats.calendar_trained_other', { count: trainedThisMonth })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label={t('common.next')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-fg-muted active:opacity-70"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {WEEKDAY_KEYS.map((key) => (
          <div key={key} className="label-caps py-1 text-center text-fg-subtle">
            {t(`userStats.weekday_${key}`)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = toLocalDateKey(day);
          const inMonth = isSameMonth(day, month);
          const didTrain = trained.has(key);
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full font-display text-xs tabular ${
                didTrain
                  ? 'bg-accent font-bold text-accent-fg'
                  : inMonth
                    ? 'text-fg-muted'
                    : 'text-fg-subtle/40'
              } ${isToday && !didTrain ? 'ring-1 ring-accent' : ''}`}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
