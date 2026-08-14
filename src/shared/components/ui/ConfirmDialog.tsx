import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Consecuencia concreta de aceptar. El título solo hace la pregunta. */
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` para acciones que borran algo y no se pueden deshacer. */
  variant?: 'default' | 'danger';
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmación con el aspecto de la app.
 *
 * Sustituye a `window.confirm`, que abría el diálogo del sistema: tipografía
 * ajena, botones en inglés según el idioma del dispositivo, ninguna relación
 * con el tema y —en el WebView de Android— con la URL de la app en la
 * cabecera. Además bloquea el hilo, así que ni siquiera se podía animar.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      titleId="confirm-dialog-title"
      showCloseButton={false}
      variant={variant}
      icon={icon}
    >
      {description && (
        <div className="mb-5 text-sm leading-relaxed text-fg-muted">{description}</div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 flex-1 rounded-pill bg-surface-2 text-sm text-fg-muted active:opacity-60"
        >
          {cancelLabel ?? t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`min-h-11 flex-1 rounded-pill text-sm font-semibold active:opacity-60 ${
            variant === 'danger' ? 'bg-error text-white' : 'bg-accent text-accent-fg'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
