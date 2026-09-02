import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionHeader, SettingRow, Toggle } from '@shared/components/ui';
import { useSettingsStore } from '@shared/stores/settingsStore';
import {
  formatTime,
  isWithinQuietHours,
  type ReminderTime,
  type QuietHours,
} from '@shared/lib/reminderTimes';

/* ── Horas de los avisos ────────────────────────────────────────────
   Antes eran constantes en notifications.ts: quien entrena por la mañana
   recibía el recordatorio a las 18:30 y no tenía dónde cambiarlo.

   Se usa <input type="time"> a propósito: el selector nativo ya sabe de
   formato 12/24 h según el idioma del sistema, y en Android abre el reloj del
   sistema en vez de un teclado. Un selector propio sería peor en las dos cosas. */

/** "HH:MM" ↔ {hour, minute}. El input siempre entrega dos dígitos. */
const toInputValue = (t: ReminderTime): string => formatTime(t);

function fromInputValue(value: string, fallback: ReminderTime): ReminderTime {
  const [h, m] = value.split(':');
  const hour = Number(h);
  const minute = Number(m);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback;
  return { hour, minute };
}

const inputClass =
  'min-h-11 rounded-pill bg-surface-2 px-3 text-sm text-fg tabular-nums ' +
  'border border-line focus:outline-none focus:ring-2 focus:ring-accent';

function TimeInput({
  value,
  onChange,
  label,
}: {
  value: ReminderTime;
  onChange: (t: ReminderTime) => void;
  label: string;
}) {
  return (
    <input
      type="time"
      aria-label={label}
      value={toInputValue(value)}
      onChange={(e) => onChange(fromInputValue(e.target.value, value))}
      className={inputClass}
    />
  );
}

interface Props {
  /** Lleva el cambio al sistema operativo. Sin esto solo cambia el store y las
      alarmas ya inscritas seguirían sonando a la hora vieja. */
  onTimesChanged: () => void;
}

export function ReminderSettings({ onTimesChanged }: Props) {
  const { t, i18n } = useTranslation();
  const reminderTimes = useSettingsStore((s) => s.reminderTimes);
  const quietHours = useSettingsStore((s) => s.quietHours);
  const setRoutineReminderTime = useSettingsStore((s) => s.setRoutineReminderTime);
  const setStreakReminderTime = useSettingsStore((s) => s.setStreakReminderTime);
  const setSummaryReminderTime = useSettingsStore((s) => s.setSummaryReminderTime);
  const setQuietHours = useSettingsStore((s) => s.setQuietHours);

  // Nombres de día del idioma activo, en la convención de Capacitor
  // (1=domingo … 7=sábado). Se generan en vez de traducirse a mano: son datos
  // que el navegador ya tiene bien en cualquier idioma.
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' });
    // 2026-01-04 fue domingo: sirve de ancla para recorrer la semana.
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2026, 0, 4 + i);
      const name = fmt.format(d);
      return { value: i + 1, label: name.charAt(0).toUpperCase() + name.slice(1) };
    });
  }, [i18n.language]);

  const apply = (fn: () => void) => {
    fn();
    onTimesChanged();
  };

  /** Un aviso programado dentro del rango de silencio se guardaría sin sonar.
      Se avisa en vez de impedirlo: el usuario manda, pero no a ciegas. */
  const conflicts = (time: ReminderTime): boolean => {
    const probe = new Date();
    probe.setHours(time.hour, time.minute, 0, 0);
    return isWithinQuietHours(quietHours as QuietHours, probe);
  };

  const conflictDesc = (time: ReminderTime): string | undefined =>
    conflicts(time) ? t('settings.quiet_conflict') : undefined;

  return (
    <section>
      <SectionHeader title={t('settings.reminder_times')} />
      <div className="glass-2 rounded-card overflow-hidden">
        <SettingRow
          label={t('settings.reminder_routine')}
          desc={conflictDesc(reminderTimes.routine)}
          control={
            <TimeInput
              label={t('settings.reminder_routine')}
              value={reminderTimes.routine}
              onChange={(time) => apply(() => setRoutineReminderTime(time))}
            />
          }
        />

        <SettingRow
          label={t('settings.reminder_streak')}
          desc={conflictDesc(reminderTimes.streak)}
          control={
            <TimeInput
              label={t('settings.reminder_streak')}
              value={reminderTimes.streak}
              onChange={(time) => apply(() => setStreakReminderTime(time))}
            />
          }
        />

        <SettingRow
          label={t('settings.reminder_summary')}
          desc={conflictDesc(reminderTimes.summary)}
          control={
            <div className="flex items-center gap-2">
              <select
                aria-label={t('settings.reminder_summary_day')}
                value={reminderTimes.summary.weekday}
                onChange={(e) =>
                  apply(() =>
                    setSummaryReminderTime({
                      ...reminderTimes.summary,
                      weekday: Number(e.target.value),
                    }),
                  )
                }
                className={inputClass}
              >
                {weekdays.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <TimeInput
                label={t('settings.reminder_summary')}
                value={reminderTimes.summary}
                onChange={(time) =>
                  apply(() => setSummaryReminderTime({ ...reminderTimes.summary, ...time }))
                }
              />
            </div>
          }
        />

        <SettingRow
          label={t('settings.quiet_hours')}
          desc={t('settings.quiet_hours_desc')}
          control={
            <Toggle
              checked={quietHours.enabled}
              onChange={() => setQuietHours({ enabled: !quietHours.enabled })}
              ariaLabel={t('settings.quiet_hours')}
            />
          }
          divider={quietHours.enabled}
        />

        {quietHours.enabled && (
          <SettingRow
            label={t('settings.quiet_hours_from')}
            desc={t('settings.quiet_hours_to')}
            control={
              <div className="flex items-center gap-2">
                <TimeInput
                  label={t('settings.quiet_hours_from')}
                  value={quietHours.start}
                  onChange={(start) => setQuietHours({ start })}
                />
                <TimeInput
                  label={t('settings.quiet_hours_to')}
                  value={quietHours.end}
                  onChange={(end) => setQuietHours({ end })}
                />
              </div>
            }
            divider={false}
          />
        )}
      </div>
    </section>
  );
}
