import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'default',
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const resolvedTitle = title ?? t('common.confirm');
  const resolvedConfirmText = confirmText ?? t('common.confirm');
  const resolvedCancelText = cancelText ?? t('common.cancel');

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  const isDanger = variant === 'danger';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={resolvedTitle}
      variant={variant}
      showCloseButton={!isLoading}
      icon={isDanger ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
    >
      <div className="space-y-4">
        <p className="text-fg-muted text-sm">{message}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isLoading} className="flex-1">
            {resolvedCancelText}
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={isLoading}
            className="flex-1"
          >
            {resolvedConfirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
