import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { Star } from '@shared/components/icons';

interface SessionRatingSheetProps {
  rating: number | null;
  notes: string;
  onRate: (rating: number | null) => void;
  onNotes: (notes: string) => void;
  onClose: () => void;
}

/**
 * Valoración de la sesión, en una hoja inferior.
 *
 * Vivía fija en la pantalla de entrenamiento, ocupando una fila de estrellas y
 * un cuadro de texto que casi nadie rellena. Ahora solo aparece cuando se pide,
 * desde el icono de estrella de la barra de acciones, y se cierra deslizando
 * hacia abajo o tocando fuera.
 *
 * Se escribe directamente en el store: lo que se ponga aquí ya viaja en el mismo
 * insert al guardar el entreno, sin actualizaciones posteriores.
 */
export function SessionRatingSheet({
  rating,
  notes,
  onRate,
  onNotes,
  onClose,
}: SessionRatingSheetProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <m.div
        key="rating-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
        className="fixed inset-0 z-[200] bg-black/50"
        aria-hidden="true"
      />
      <m.div
        key="rating-panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('workout.session_rating')}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
        drag="y"
        dragDirectionLock
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 500) onClose();
        }}
        className="fixed inset-x-0 bottom-0 z-[201] rounded-t-[24px] border-t border-line bg-surface px-4 pt-3 outline-none"
        style={{ paddingBottom: 'calc(1.5rem + var(--inset-bottom, env(safe-area-inset-bottom)))' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-pill bg-line-strong" aria-hidden="true" />

        <h2 className="font-display text-lg font-bold text-fg">{t('workout.session_rating')}</h2>

        <div className="mt-3 flex items-center justify-between">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${t('workout.session_rating')} ${n}`}
              aria-pressed={rating === n}
              onClick={() => {
                void impact(ImpactStyle.Light);
                onRate(rating === n ? null : n);
              }}
              className="flex h-14 flex-1 items-center justify-center"
            >
              <Star
                className={`h-8 w-8 transition-colors ${
                  rating && n <= rating ? 'fill-accent text-accent' : 'text-fg-subtle'
                }`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          placeholder={t('workout.session_notes_placeholder')}
          rows={3}
          aria-label={t('workout.session_notes')}
          className="mt-3 w-full resize-none glass-2 rounded-card-2 p-3 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent"
        />

        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-12 w-full rounded-pill bg-accent font-semibold text-accent-fg transition-transform active:scale-[0.98]"
        >
          {t('common.ready')}
        </button>
      </m.div>
    </>
  );
}
