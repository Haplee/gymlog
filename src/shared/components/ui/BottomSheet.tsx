import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Xmark } from '@shared/components/icons';
import { useTranslation } from 'react-i18next';
import { registerBackAction } from '@shared/lib/backHandler';
import { Capacitor } from '@capacitor/core';

// backdrop-filter provoca jank en el WebView de Android de gama media/baja al
// animar la apertura/cierre; ahí se sustituye por un fondo más opaco.
const IS_ANDROID = Capacitor.getPlatform() === 'android';
const BACKDROP_STYLE = IS_ANDROID
  ? { backgroundColor: 'rgba(0,0,0,0.6)' }
  : { backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' };

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
  const backId = useId();

  const accentColor = variant === 'danger' ? 'var(--error)' : 'var(--interactive-primary)';
  const iconBg = variant === 'danger' ? 'var(--icon-bg-danger)' : 'var(--icon-bg-accent)';

  // El atrás de Android cierra el diálogo en vez de navegar fuera. Vive aquí y
  // no en cada consumidor: `BottomSheet` lo usan varias pantallas y ninguna lo
  // registraba por su cuenta, así que en la APK el gesto de atrás sobre un
  // diálogo abierto hacía `history.back()` —o cerraba la app desde la raíz—
  // dejando el diálogo detrás. `Escape` solo cubre el teclado.
  useEffect(() => {
    if (!open) return;
    return registerBackAction(`sheet-${backId}`, onClose);
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
            style={BACKDROP_STYLE}
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
            className="glass-3 fixed bottom-0 left-0 right-0 z-[calc(var(--z-modal)+1)] flex flex-col rounded-t-card"
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
                      className="w-8 h-8 rounded-md flex items-center justify-center"
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
                    type="button"
                    onClick={onClose}
                    aria-label={t('common.close')}
                    className="h-11 w-11 rounded-full flex items-center justify-center text-fg-subtle hover:bg-surface-2 hover:text-fg active:bg-hover transition-colors"
                  >
                    <Xmark size={16} />
                  </button>
                )}
              </div>
            )}

            <div className="overflow-y-auto overscroll-contain flex-1 px-4 pb-[var(--inset-bottom,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
