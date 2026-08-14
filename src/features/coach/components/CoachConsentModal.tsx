import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@shared/components/ui';
import { Database, HeartPulse, Server, Sparkles, Undo } from '@shared/components/icons';

/**
 * Consentimiento para activar el entrenador IA.
 *
 * No es un "acepto los términos": enumera literalmente qué sale del
 * dispositivo, quién lo procesa y qué no es. Son datos de salud, y el proveedor
 * gratuito no trae acuerdo de tratamiento de datos — eso se dice, no se
 * esconde.
 *
 * El botón de activar NO va preseleccionado ni autofocuseado a propósito.
 */
export function CoachConsentModal({
  open,
  onAccept,
  onClose,
  loading = false,
}: {
  open: boolean;
  onAccept: () => void;
  onClose: () => void;
  loading?: boolean;
}) {
  const { t } = useTranslation();

  const blocks = [
    {
      icon: <Database className="w-4 h-4" aria-hidden="true" />,
      title: t('coach.consent.data_title'),
      items: [
        t('coach.consent.data_profile'),
        t('coach.consent.data_body'),
        t('coach.consent.data_training'),
        t('coach.consent.data_wearable'),
      ],
      note: t('coach.consent.data_never'),
    },
    {
      icon: <Server className="w-4 h-4" aria-hidden="true" />,
      title: t('coach.consent.provider_title'),
      body: t('coach.consent.provider_body'),
    },
    {
      icon: <HeartPulse className="w-4 h-4" aria-hidden="true" />,
      title: t('coach.consent.medical_title'),
      body: t('coach.consent.medical_body'),
    },
    {
      icon: <Undo className="w-4 h-4" aria-hidden="true" />,
      title: t('coach.consent.revoke_title'),
      body: t('coach.consent.revoke_body'),
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('coach.consent.title')}
      icon={<Sparkles className="w-5 h-5" aria-hidden="true" />}
    >
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">{t('coach.consent.intro')}</p>

        {blocks.map((block) => (
          <section key={block.title} className="rounded-card bg-surface-2 p-3.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <span className="text-accent">{block.icon}</span>
              {block.title}
            </h3>
            {block.items && (
              <ul className="mt-2 space-y-1 text-xs text-fg-muted">
                {block.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
            {block.note && <p className="mt-2 text-xs font-medium text-fg">{block.note}</p>}
            {block.body && <p className="mt-1.5 text-xs text-fg-muted">{block.body}</p>}
          </section>
        ))}

        <div className="flex flex-col gap-2 pt-1">
          <Button variant="primary" onClick={onAccept} loading={loading} className="w-full">
            {t('coach.consent.accept')}
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            {t('coach.consent.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
