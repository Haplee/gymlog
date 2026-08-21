import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { AlertCircle } from '@shared/components/icons';
import { ConfirmDialog } from '@shared/components/ui';

/**
 * Lo primero que se ve al reabrir la app con una sesión sin guardar.
 *
 * «Descartar» borraba las series anotadas al primer toque y sin deshacer. La
 * misma acción de fondo —vaciar la sesión en curso— sí pasa por `ConfirmDialog`
 * desde la propia pantalla (`WorkoutSessionStats`), así que el camino peligroso
 * era justamente el que menos avisa: el usuario acaba de abrir la app y todavía
 * no sabe qué hay dentro de esa sesión.
 */
export function ResumeWorkoutBanner({
  onContinue,
  onDiscard,
  /** Series que se perderían; se dice en el diálogo. */
  setCount,
}: {
  onContinue: () => void;
  onDiscard: () => void;
  setCount: number;
}) {
  const { t } = useTranslation();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mb-4 p-4 rounded-md border-2 border-accent bg-accent/5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2 text-accent">
        <AlertCircle className="w-5 h-5" />
        <span className="font-semibold text-sm">{t('workout.resume_banner')}</span>
      </div>
      <p className="text-xs text-fg-muted">{t('workout.resume_desc')}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 py-2 rounded-card bg-accent text-accent-fg text-xs font-bold transition-transform active:scale-[0.98]"
        >
          {t('workout.continue')}
        </button>
        <button
          type="button"
          onClick={() => setConfirmDiscard(true)}
          className="flex-1 py-2 rounded-card border border-line-strong text-fg-muted text-xs font-medium transition-transform active:scale-[0.98]"
        >
          {t('workout.discard')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title={t('workout.cancel_confirm_title')}
        description={t('workout.cancel_confirm_body', { count: setCount })}
        confirmLabel={t('workout.cancel_confirm_accept')}
        cancelLabel={t('workout.cancel_confirm_keep')}
        onConfirm={() => {
          setConfirmDiscard(false);
          onDiscard();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </m.div>
  );
}
