import { useTranslation } from 'react-i18next';
import { localDay } from '@features/routine/stores/routineStore';
import { Button } from '@shared/components/ui';

interface ScheduleRoutineDialogProps {
  /** Rutina cuyo calendario se está editando; null = cerrado. */
  routineId: string | null;
  /** Fecha elegida (yyyy-mm-dd), controlada por la página. */
  draft: string;
  /** Si esa rutina ya tenía una fecha: se ofrece quitarla. */
  hasExistingSchedule: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
}

/** Diálogo para programar la fecha en la que una rutina pasa a ser la activa. */
export function ScheduleRoutineDialog({
  routineId,
  draft,
  hasExistingSchedule,
  onDraftChange,
  onSave,
  onClear,
  onClose,
}: ScheduleRoutineDialogProps) {
  const { t } = useTranslation();

  if (!routineId) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="rounded-card p-4 w-full max-w-sm bg-surface border border-line">
        <div className="text-data font-display font-bold text-fg">
          {t('routine.schedule_title')}
        </div>
        <p className="text-xs mt-1 mb-4 text-fg-subtle">{t('routine.schedule_help')}</p>

        <label htmlFor="routine-schedule-date" className="label-caps block mb-1.5 text-fg-muted">
          {t('routine.schedule_date_label')}
        </label>
        <input
          id="routine-schedule-date"
          type="date"
          value={draft}
          min={localDay()}
          onChange={(e) => onDraftChange(e.target.value)}
          className="w-full p-2.5 rounded-sm text-sm mb-4 bg-surface-2 border border-line-strong text-fg focus:border-accent outline-none"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-11 rounded-pill text-sm bg-surface-2 text-fg-muted"
          >
            {t('common.cancel')}
          </button>
          <Button
            type="button"
            onClick={onSave}
            disabled={!draft}
            className="flex-1 font-display font-bold uppercase tracking-[0.08em]"
          >
            {t('common.save')}
          </Button>
        </div>

        {hasExistingSchedule && (
          <button
            type="button"
            onClick={onClear}
            className="w-full mt-2 min-h-11 rounded-pill text-sm text-error"
          >
            {t('routine.schedule_clear')}
          </button>
        )}
      </div>
    </div>
  );
}
