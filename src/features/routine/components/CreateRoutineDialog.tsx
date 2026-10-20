import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui';

interface CreateRoutineDialogProps {
  open: boolean;
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
}

/** Diálogo para crear una rutina propia vacía. */
export function CreateRoutineDialog({
  open,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onCreate,
  onClose,
}: CreateRoutineDialogProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="rounded-card p-4 w-full max-w-sm bg-surface border border-line">
        <div className="text-data font-display font-bold mb-4 text-fg">
          {t('routine.new_routine')}
        </div>

        <input
          type="text"
          placeholder={t('routine.name_placeholder')}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full p-2.5 rounded-sm text-sm mb-2 bg-surface-2 border border-line-strong text-fg placeholder:text-fg-subtle focus:border-accent outline-none"
        />

        <input
          type="text"
          placeholder={t('routine.desc_placeholder')}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="w-full p-2.5 rounded-sm text-sm mb-4 bg-surface-2 border border-line-strong text-fg placeholder:text-fg-subtle focus:border-accent outline-none"
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
            onClick={onCreate}
            className="flex-1 font-display font-bold uppercase tracking-[0.08em]"
          >
            {t('routine.create')}
          </Button>
        </div>
      </div>
    </div>
  );
}
