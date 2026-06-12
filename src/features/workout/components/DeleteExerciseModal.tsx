import { useRef, useEffect } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Modal } from '@shared/components/ui/Modal';
import { Button } from '@shared/components/ui';

interface DeleteExerciseModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  exerciseName: string;
  isDeleting?: boolean;
}

export function DeleteExerciseModal({
  open,
  onClose,
  onConfirm,
  exerciseName,
  isDeleting = false,
}: DeleteExerciseModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && confirmRef.current) {
      const timer = setTimeout(() => confirmRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isDeleting) {
      onConfirm();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Eliminar ejercicio"
      titleId="delete-exercise-modal-title"
      icon={<Trash2 className="w-5 h-5 text-error" />}
      variant="danger"
    >
      <div onKeyDown={handleKeyDown}>
        <p className="text-fg-muted mb-2">
          ¿Eliminar <strong className="text-fg">{exerciseName}</strong> del entrenamiento?
        </p>

        <p className="text-sm text-fg-subtle mb-6">Se eliminarán todas las series asociadas.</p>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting} className="flex-1">
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1"
            style={{ backgroundColor: 'var(--error)' }}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Eliminando...
              </>
            ) : (
              'Eliminar'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
