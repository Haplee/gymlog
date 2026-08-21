import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Xmark } from '@shared/components/icons';
import { useTranslation } from 'react-i18next';
import { registerBackAction } from '@shared/lib/backHandler';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  titleId?: string;
  children: ReactNode;
  showCloseButton?: boolean;
  icon?: ReactNode;
  variant?: 'default' | 'danger';
}

export function Modal({
  open,
  onClose,
  title,
  titleId = 'modal-title',
  children,
  showCloseButton = true,
  icon,
  variant = 'default',
}: ModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const backId = useId();

  const accentColor = variant === 'danger' ? 'var(--error)' : 'var(--interactive-primary)';
  const iconBg = variant === 'danger' ? 'var(--icon-bg-danger)' : 'var(--icon-bg-accent)';

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement;
      const frame = requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    } else {
      previouslyFocused.current?.focus();
    }
  }, [open]);

  // El atrás de Android cierra el diálogo en vez de navegar fuera. Vive aquí y
  // no en cada consumidor: `Modal` lo usan doce pantallas y ninguna lo
  // registraba por su cuenta, así que en la APK el gesto de atrás sobre un
  // diálogo abierto hacía `history.back()` —o cerraba la app desde la raíz—
  // dejando el diálogo detrás. `Escape` solo cubre el teclado.
  useEffect(() => {
    if (!open) return;
    return registerBackAction(`modal-${backId}`, onClose);
  }, [open, onClose, backId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

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
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          // El overlay no tenía fondo: el diálogo no se leía como modal y los
          // controles de detrás parecían pulsables (aunque el focus trap ya los
          // bloqueaba). El oscurecido comunica que el fondo está inactivo.
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="glass-3 relative z-10 w-full max-w-md overflow-hidden rounded-card"
          >
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ backgroundColor: accentColor }}
            />

            <div className="p-5 pt-6">
              {(title || icon || showCloseButton) && (
                <div className="flex items-center gap-3 mb-4">
                  {icon && (
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: iconBg }}
                    >
                      {icon}
                    </div>
                  )}
                  {title && (
                    <h2 id={titleId} className="text-lg font-semibold text-fg flex-1">
                      {title}
                    </h2>
                  )}
                  {showCloseButton && !title && (
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={t('common.close')}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-fg-subtle hover:bg-surface-2 hover:text-fg transition-colors"
                    >
                      <Xmark size={16} />
                    </button>
                  )}
                  {showCloseButton && title && (
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={t('common.close')}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-fg-subtle hover:bg-surface-2 hover:text-fg transition-colors"
                    >
                      <Xmark size={16} />
                    </button>
                  )}
                </div>
              )}

              {children}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
