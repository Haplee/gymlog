import { useRef, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
    >
      <div className="flex flex-col items-center text-center py-2" onKeyDown={handleKeyDown}>
        <div className="w-12 h-12 rounded-full bg-[--color-error]/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-[--color-error]" />
        </div>

        <p className="text-[--text-primary] mb-2">
          ¿Estás seguro de que quieres eliminar{' '}
          <strong className="text-[--text-primary]">{exerciseName}</strong> del entrenamiento?
        </p>

        <p className="text-sm text-[--text-muted] mb-6">
          Esta acción eliminará todas las series asociadas a este ejercicio.
        </p>

        <div className="flex gap-3 w-full">
          <Button variant="ghost" onClick={onClose} disabled={isDeleting} className="flex-1">
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isDeleting} className="flex-1">
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
