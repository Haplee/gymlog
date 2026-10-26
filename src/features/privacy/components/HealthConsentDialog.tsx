import { useTranslation } from 'react-i18next';
import { Modal } from '@shared/components/ui';
import { HeartPulse } from '@shared/components/icons';

/**
 * Diálogo de consentimiento para datos de salud.
 *
 * No usa `ConfirmDialog` a propósito: aquel es para confirmar una acción
 * destructiva y tiene el botón de confirmar en rojo. Aquí se pide permiso para
 * tratar datos, y el texto tiene que poder explicar la finalidad y la
 * alternativa (no usar la función) sin que parezca una advertencia.
 */
export function HealthConsentDialog({
  open,
  onAccept,
  onCancel,
}: {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={t('privacy.health_consent_title')}
      titleId="health-consent-title"
      showCloseButton={false}
      icon={<HeartPulse className="w-5 h-5" />}
    >
      <div className="mb-5 space-y-3 text-sm leading-relaxed text-fg-muted">
        <p>{t('privacy.health_consent_body')}</p>
        <p className="text-xs text-fg-subtle">{t('privacy.health_consent_note')}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 flex-1 rounded-pill bg-surface-2 text-sm text-fg-muted active:opacity-60"
        >
          {t('privacy.health_consent_cancel')}
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="min-h-11 flex-1 rounded-pill bg-accent text-sm font-semibold text-accent-fg active:opacity-60"
        >
          {t('privacy.health_consent_accept')}
        </button>
      </div>
    </Modal>
  );
}
