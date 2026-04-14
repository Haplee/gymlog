import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** ID del elemento que actúa como label del modal (aria-labelledby) */
  titleId?: string;
  children: ReactNode;
  /** Ancho máximo del panel. Default: max-w-md */
  maxWidth?: string;
}

/**
 * Modal accesible con backdrop blur, animación de entrada/salida,
 * focus trap y cierre con Escape.
 *
 * @example
 * <Modal open={isOpen} onClose={() => setOpen(false)} title="Confirmar">
 *   <p>¿Estás seguro?</p>
 * </Modal>
 */
export function Modal({
  open,
  onClose,
  title,
  titleId = 'modal-title',
  children,
  maxWidth = 'max-w-md',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Guardar foco anterior + focus trap
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement;
      // Esperar al siguiente frame para que el portal esté en el DOM
      const frame = requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    } else {
      previouslyFocused.current?.focus();
    }
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Bloquear scroll del body
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[--z-modal] flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: 'var(--bg-overlay)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          aria-hidden="true"
        >
          {/* Backdrop blur */}
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ backgroundColor: 'var(--bg-overlay)' }}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={[
              'relative z-10 w-full rounded-[--radius-2xl]',
              'bg-[--bg-surface] border border-[--border-default]',
              'shadow-[--shadow-lg] p-6 focus:outline-none',
              maxWidth,
            ].join(' ')}
            aria-hidden="false"
          >
            {title && (
              <h2
                id={titleId}
                className="text-[--text-xl] font-semibold text-[--text-primary] mb-4"
              >
                {title}
              </h2>
            )}

            {/* Botón cerrar */}
            <button
              onClick={onClose}
              aria-label="Cerrar modal"
              className="absolute top-4 right-4 p-1.5 rounded-[--radius-md] text-[--text-muted] hover:bg-[--bg-elevated] hover:text-[--text-primary] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
