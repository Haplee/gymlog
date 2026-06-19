import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
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
            className="relative z-10 w-full rounded-card overflow-hidden max-w-md bg-surface shadow-lg"
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
                      className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: iconBg }}
                    >
                      {icon}
                    </div>
                  )}
                  {title && (
                    <h2 id={titleId} className="text-[1rem] font-semibold text-fg flex-1">
                      {title}
                    </h2>
                  )}
                  {showCloseButton && !title && (
                    <button
                      onClick={onClose}
                      aria-label={t('common.close')}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-fg-subtle hover:bg-surface-2 hover:text-fg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {showCloseButton && title && (
                    <button
                      onClick={onClose}
                      aria-label={t('common.close')}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-fg-subtle hover:bg-surface-2 hover:text-fg transition-colors"
                    >
                      <X className="w-4 h-4" />
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
