import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Altura máxima como % del viewport. Default: 85 */
  maxHeightVh?: number;
}

/**
 * Drawer desde abajo (más natural que modal en mobile).
 * Incluye drag handle, cierre con Escape y backdrop.
 *
 * @example
 * <BottomSheet open={open} onClose={() => setOpen(false)} title="Seleccionar ejercicio">
 *   <ExerciseList />
 * </BottomSheet>
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeightVh = 85,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

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
      // Foco al panel
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
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[--z-modal] backdrop-blur-sm"
            style={{ backgroundColor: 'var(--bg-overlay)' }}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[calc(var(--z-modal)+1)] flex flex-col rounded-t-[--radius-2xl] bg-[--bg-surface] border-t border-[--border-default] focus:outline-none"
            style={{ maxHeight: `${maxHeightVh}dvh` }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-[--border-strong]" />
            </div>

            {/* Header */}
            {title && (
              <div className="px-4 pb-3 flex items-center justify-between flex-shrink-0 border-b border-[--border-default]">
                <h2 className="font-semibold text-[--text-primary] text-[--text-lg]">{title}</h2>
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="p-1.5 rounded-[--radius-md] text-[--text-muted] hover:bg-[--bg-elevated] hover:text-[--text-primary] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]"
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
              </div>
            )}

            {/* Content (scrollable) */}
            <div className="overflow-y-auto overscroll-contain flex-1 pb-[env(safe-area-inset-bottom)]">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
