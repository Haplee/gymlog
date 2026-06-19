import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxHeightVh?: number;
  showCloseButton?: boolean;
  icon?: ReactNode;
  variant?: 'default' | 'danger';
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeightVh = 85,
  showCloseButton = true,
  icon,
  variant = 'default',
}: BottomSheetProps) {
  const { t } = useTranslation();
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const accentColor = variant === 'danger' ? 'var(--error)' : 'var(--interactive-primary)';
  const iconBg = variant === 'danger' ? 'var(--icon-bg-danger)' : 'var(--icon-bg-accent)';

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
      requestAnimationFrame(() => sheetRef.current?.focus());
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
        <>
          <m.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[var(--z-modal)]"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            aria-hidden="true"
          />

          <m.div
            key="sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[calc(var(--z-modal)+1)] flex flex-col rounded-t-card bg-surface shadow-lg"
            style={{ maxHeight: `${maxHeightVh}dvh` }}
          >
            <div
              className="h-1 flex-shrink-0 rounded-t-full"
              style={{ backgroundColor: accentColor }}
            />

            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-line" />
            </div>

            {(title || icon || showCloseButton) && (
              <div className="px-4 pb-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  {icon && (
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: iconBg }}
                    >
                      {icon}
                    </div>
                  )}
                  {title && (
                    <h2 id={titleId} className="font-semibold text-fg">
                      {title}
                    </h2>
                  )}
                </div>
                {showCloseButton && (
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

            <div className="overflow-y-auto overscroll-contain flex-1 px-4 pb-[env(safe-area-inset-bottom)]">
              {children}
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
